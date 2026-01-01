import {
  ref,
  onMounted,
  onUnmounted,
} from 'vue';

const NEWS_COUNT = 20;

/**
 * Daftar simbol saham/kripto awal yang akan dilacak.
 * @type {Array<{code: string, name: string}>}
 */
import INITIAL_SYMBOLS from './Symbol.js'

/**
 * Hook komposisi untuk mengelola fitur-fitur yang berhubungan dengan data saham/pasar.
 * Menggunakan Finnhub API untuk data awal dan real-time (via WebSocket).
 * @returns {{
 * stockData: import('vue').Ref<Object<string, *>>,
 * symbols: import('vue').Ref<Array<{code: string, name: string}>>,
 * searchInput: import('vue').Ref<string>,
 * searchResults: import('vue').Ref<Array<*>>,
 * isSearching: import('vue').Ref<boolean>,
 * showSearchResults: import('vue').Ref<boolean>,
 * activeView: import('vue').Ref<string>,
 * marketNews: import('vue').Ref<Array<*>>,
 * newsLoading: import('vue').Ref<boolean>,
 * modalVisible: import('vue').Ref<boolean>,
 * selectedStock: import('vue').Ref<*>,
 * formatMarketCap: function(number): string,
 * getDisplayCode: function(string): string,
 * searchSymbol: function(): Promise<void>,
 * addStockToTable: function(string, string): Promise<void>,
 * showStockDetail: function(string): void,
 * closeModal: function(): void,
 * downloadCSV: function(): void,
 * switchView: function(string): void
 * }}
 */
export default function useStockFeatures() {
  /** @type {import('vue').Ref<Object<string, *>>} */
  const stockData = ref({});
  /** @type {import('vue').Ref<Array<{code: string, name: string}>>} */
  const symbols = ref(INITIAL_SYMBOLS);
  /** @type {import('vue').Ref<WebSocket | null>} */
  const socket = ref(null);
  /** @type {import('vue').Ref<string>} */
  const searchInput = ref('');
  /** @type {import('vue').Ref<Array<*>>} */
  const searchResults = ref([]);
  /** @type {import('vue').Ref<boolean>} */
  const isSearching = ref(false);
  /** @type {import('vue').Ref<boolean>} */
  const showSearchResults = ref(false);
  /** @type {import('vue').Ref<('traffic'|'news')>} */
  const activeView = ref('traffic');
  /** @type {import('vue').Ref<Array<*>>} */
  const marketNews = ref([]);
  /** @type {import('vue').Ref<boolean>} */
  const newsLoading = ref(false);
  /** @type {import('vue').Ref<boolean>} */
  const modalVisible = ref(false);
  /** @type {import('vue').Ref<*|null>} */
  const selectedStock = ref(null);
  
  const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
  const BASE_URL = import.meta.env.VITE_FINNHUB_BASE_URL;

  /**
   * Format kapitalisasi pasar ke format singkatan (T, B, M).
   * @param {number} cap - Nilai kapitalisasi pasar.
   * @returns {string} Kapitalisasi pasar yang diformat.
   */
  function formatMarketCap(cap) {
    if (typeof cap !== 'number' || cap <= 0) return '-';
    
    const units = ['T', 'B', 'M'];
    let unitIndex = 2;
    
    if (cap >= 1e12) unitIndex = 0;
    else if (cap >= 1e9) unitIndex = 1;
    else if (cap < 1e6 && cap > 0) {
      return cap.toLocaleString('en-US');
    }
    
    const divisor = [1e12, 1e9, 1e6][unitIndex];
    const value = cap / divisor;
    
    return `${value.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Format kode simbol untuk tampilan.
   * Menghapus awalan 'BINANCE:' dan mengganti 'USDT' menjadi '/USD'.
   * @param {string} code - Kode simbol asli.
   * @returns {string} Kode simbol untuk tampilan.
   */
  function getDisplayCode(code) {
    return code
      .replace('BINANCE:', '')
      .replace('USDT', '/USD');
  }

  /**
   * Mendapatkan data awal (profil dan quote) untuk simbol tertentu dari Finnhub API.
   * @param {string} code - Kode simbol yang akan dicari (e.g., 'NVDA', 'BTC/USDT').
   * @param {string} initialName - Nama awal untuk digunakan jika profil tidak tersedia.
   * @returns {Promise<*|null>} Objek data saham/kripto atau `null` jika gagal.
   */
  async function fetchInitialDataForSymbol(code, initialName = '') {
    const isCrypto = code.includes('/');
    // Simbol untuk Finnhub API: tambahkan BINANCE: dan hapus slash
    const symbolToFetch = isCrypto ? `BINANCE:${code.replace('/', '')}` : code; 
    
    try {
      const [profile, quote] = await Promise.all([
        fetch(`${BASE_URL}/stock/profile2?symbol=${symbolToFetch}&token=${API_KEY}`)
          .then(res => res.ok ? res.json() : {})
          .catch(() => ({})),
        
        fetch(`${BASE_URL}/quote?symbol=${symbolToFetch}&token=${API_KEY}`)
          .then(res => res.ok ? res.json() : { c: 0 })
          .catch(() => ({ c: 0 }))
      ]);
      
      if (!quote.c || quote.c === 0) {
        return null;
      }
      
      let initialChangePercent = quote.dp || 0;
      
      return {
        code: symbolToFetch, // Simpan kode yang di-fetch (BINANCE:BTCUSDT) untuk WebSocket
        name: profile.name || initialName || symbolToFetch.replace('BINANCE:', ''),
        logoUrl: profile.logo,
        webUrl: profile.weburl || '#',
        marketCap: profile.marketCapitalization || profile.mc || 0,
        exchange: profile.exchange || (isCrypto ? 'BINANCE' : 'N/A'),
        currency: profile.currency || (isCrypto ? code.split('/')[1] : 'USD'),
        ipoDate: profile.ipo || 'N/A',
        currentPrice: quote.c || 0,
        openPrice: quote.o || 0,
        highPrice: quote.h || 0, 
        lowPrice: quote.l || 0,   
        prevClose: quote.pc || 0, 
        initialChangePercent: initialChangePercent,
        lastTradeVolume: 0,
        previousPrice: quote.c || 0, 
        priceDirection: 'neutral'
      };
    } catch (error) {
      console.error(`Error fetching data for ${code}:`, error);
      return null;
    }
  }

  /**
   * Memuat semua data awal untuk simbol-simbol yang ada dalam `INITIAL_SYMBOLS`.
   * Setelah selesai, akan memanggil `connectWebSocket`.
   * @returns {Promise<void>}
   */
  async function fetchAllInitialData() {
    const initialSymbolsCopy = [...symbols.value];
    const promises = initialSymbolsCopy.map(stock => 
      fetchInitialDataForSymbol(stock.code, stock.name)
    );
    
    const results = await Promise.all(promises);
    
    // Perbarui symbols dan stockData dengan data yang berhasil di-fetch
    const validSymbols = [];
    results.forEach(data => {
      if (data) {
        stockData.value[data.code] = data;
        validSymbols.push({
          code: data.code, 
          name: data.name
        });
      }
    });

    symbols.value = validSymbols;
    
    connectWebSocket();
  }

  /**
   * Menghubungkan ke Finnhub WebSocket untuk data real-time dan berlangganan simbol-simbol yang ada.
   * Menerapkan logika *reconnection* sederhana.
   * @returns {void}
   */
  function connectWebSocket() {
    if (socket.value) socket.value.close();
    
    socket.value = new WebSocket(`wss://ws.finnhub.io?token=${API_KEY}`);
    
    socket.value.onopen = () => {
      symbols.value.forEach(symbol => {
        // Gunakan kode yang di-fetch (BINANCE:BTCUSDT atau NVDA) untuk subscribe
        socket.value.send(JSON.stringify({
          type: 'subscribe', 
          symbol: symbol.code 
        }));
      });
    };
    
    socket.value.onmessage = event => {
      const data = JSON.parse(event.data);
      if (data.type === 'trade' && data.data) {
        data.data.forEach(trade => {
          updateStockPrice({ 
            p: trade.p,   // price
            v: trade.v,   // volume
            code: trade.s // symbol
          });
        });
      }
    };
    
    socket.value.onclose = () => {
      console.log('WebSocket disconnected. Retrying in 3 seconds...');
      setTimeout(connectWebSocket, 3000);
    };
    
    socket.value.onerror = (err) => console.error('WebSocket error:', err);
  }

  /**
   * Update data harga saham real-time berdasarkan data *trade* dari WebSocket.
   * Memperbarui harga, volume, persentase perubahan, dan arah harga (*price direction*).
   * @param {{p: number, v?: number, code: string}} data - Data *trade* Finnhub (harga, volume, simbol).
   * @returns {void}
   */
  function updateStockPrice(data) {
    const code = data.code;
    const newPrice = data.p;
    const newVolume = data.v || 0;
    const currentData = stockData.value[code];
    
    if (!currentData || newPrice === undefined) return;
    
    const oldPrice = currentData.currentPrice;
    const change = newPrice - oldPrice;
    
    let changePercent = currentData.initialChangePercent;
    if (currentData.openPrice > 0) {
      changePercent = (newPrice - currentData.openPrice) / currentData.openPrice * 100;
    }
    
    // Update harga dan volume
    currentData.currentPrice = newPrice;
    currentData.lastTradeVolume = newVolume;
    currentData.initialChangePercent = changePercent;
    
    // Update price direction untuk warna real-time
    if (change > 0) {
      currentData.priceDirection = 'up';
    } else if (change < 0) {
      currentData.priceDirection = 'down';
    }
    // Jika change = 0, biarkan direction sebelumnya
    
    // Reset direction ke neutral setelah 2 detik
    setTimeout(() => {
      if (stockData.value[code]) {
        stockData.value[code].priceDirection = 'neutral';
      }
    }, 2000);
    
    // Jika modal terbuka, update juga selectedStock
    if (modalVisible.value && selectedStock.value?.code === code) {
      Object.assign(selectedStock.value, currentData);
    }
  }

  /**
   * Mencari simbol saham/kripto menggunakan Finnhub API search dan/atau mencoba data langsung.
   * Hasil disimpan dalam `searchResults`.
   * @returns {Promise<void>}
   */
  async function searchSymbol() {
    const query = searchInput.value.trim().toUpperCase();
    searchResults.value = [];
    showSearchResults.value = false;
    
    if (query.length < 1) return;
    
    isSearching.value = true;
    
    let results = [];
    
    try {
      const url = `${BASE_URL}/search?q=${query}&token=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.result && data.result.length > 0) {
        results.push(...data.result.map(item => ({
          symbol: item.symbol,
          description: item.description,
          type: item.type || 'Stock',
          exchange: item.exchange || 'N/A'
        })));
      }   
    } catch (error) {
      console.error('Search error:', error);
    }
    
    // Coba fetch langsung jika tidak ada hasil atau query terlihat seperti simbol kripto
    if (results.length === 0 || query.includes('/')) {
      const directData = await fetchInitialDataForSymbol(query);
      if (directData) {
        results.push({
          symbol: directData.code,
          description: directData.name,
          type: directData.code.includes('BINANCE') ? 'Crypto' : 'Stock',
          exchange: directData.exchange
        });
      }
    }
    
    // Filter duplikat berdasarkan simbol
    results = results.filter((item, index, self) =>
      index === self.findIndex((t) => 
        t.symbol === item.symbol
      )
    );
    
    searchResults.value = results;
    showSearchResults.value = true;
    isSearching.value = false;
  }

  /**
   * Menambahkan simbol baru ke tabel pelacakan dan berlangganan WebSocket jika terhubung.
   * @param {string} rawCode - Kode simbol mentah dari search (e.g., 'NVDA', 'BTC/USDT').
   * @param {string} name - Nama simbol (opsional).
   * @returns {Promise<void>}
   */
  async function addStockToTable(rawCode, name) {
    const isCrypto = rawCode.includes('/');
    const code = isCrypto ? `BINANCE:${rawCode.replace('/', '')}` : rawCode;

    if (stockData.value[code]) {
      searchResults.value = [{ 
        symbol: code,
        type: 'Message',
        exchange: '...',
        description: `${name} (${rawCode}) is already in the table.`
      }];
      
      return;
    }
    
    // Gunakan rawCode (e.g., 'BTC/USDT') untuk fetching agar fungsi internal yang menentukan format finnhub (BINANCE:BTCUSDT)
    const newStockData = await fetchInitialDataForSymbol(rawCode, name); 
    
    if (!newStockData) {
      searchResults.value = [{ 
        symbol: 'Error',
        type: 'Message',
        exchange: 'Error',
        description: `Failed to add ${rawCode}. Symbol may not be supported.`
      }];
      
      return;
    }
    
    stockData.value[newStockData.code] = newStockData;
    symbols.value.push({ 
      code: newStockData.code,
      name: newStockData.name
    });
    
    if (socket.value && socket.value.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify({ 
        type: 'subscribe', 
        symbol: newStockData.code // Gunakan kode yang sudah diformat Finnhub
      }));
    }

    searchInput.value = '';
    showSearchResults.value = false;
  }

  /**
   * Fetch market news dari Finnhub API.
   * Hasil disimpan dalam `marketNews`.
   * @returns {Promise<void>}
   */
  async function fetchMarketNews() {
    newsLoading.value = true;
    marketNews.value = [];

    const url = `${BASE_URL}/news?category=general&minId=0&token=${API_KEY}`;
    
    try {
      const res = await fetch(url).then(r => r.json());

      if (res && res.length > 0) {
        marketNews.value = res.slice(0, NEWS_COUNT).map(news => ({
          ...news,
          date: new Date(news.datetime * 1000).toLocaleDateString(),
          image: news.image || 'https://placehold.co/80x80/f0f0f0/666?text=NO+IMG',
          source: news.source || 'N/A',
          headline: news.headline || 'No Headline',
          summary: news.summary || 'Click to read full story.',
        }));
      } else {
        marketNews.value = 'Cannot load market news!';
      }
    } catch (err) {
      console.error(err);
      marketNews.value = 'An error occurred while retrieving news data!';
    } finally {
      newsLoading.value = false;
    }
  }

  /**
   * Menampilkan modal detail untuk saham/kripto tertentu.
   * @param {string} code - Kode simbol yang detailnya akan ditampilkan.
   * @returns {void}
   */
  function showStockDetail(code) {
    const stock = stockData.value[code];
    if (!stock) return;
    
    selectedStock.value = stock;
    modalVisible.value = true;
  }

  /**
   * Menutup modal detail.
   * @returns {void}
   */
  function closeModal() {
    modalVisible.value = false;
    selectedStock.value = null;
  }

  /**
   * Mengunduh data pasar saat ini dalam format CSV.
   * @returns {void}
   */
  function downloadCSV() {
    const data = Object.values(stockData.value);
    if (data.length === 0) {
      console.warn('Table data is empty.');
      return;
    }
    
    let csv = [[
      "Symbols", 
      "Name",
      "Price ($)", 
      "Volume/Traffic (Last Trade Size)", 
      "Change (%)",
      "Market Capitalization",
      "Exchange", 
      "Currency",
      "IPO Date", 
      "API Source"
    ].join(',')];
    
    data.forEach(item => {
      const row = [
        getDisplayCode(item.code).replace(/,/g, ''), // Gunakan display code di CSV
        item.name.replace(/,/g, ' '),
        item.currentPrice.toFixed(4),
        item.lastTradeVolume.toString(),
        item.initialChangePercent.toFixed(2) + '%',
        item.marketCap.toString(),
        item.exchange.replace(/,/g, ''),
        item.currency.replace(/,/g, ''),
        item.ipoDate.replace(/,/g, ''),
        'finnhub'
      ].join(',');
      csv.push(row);
    });
    
    const downloadLink = document.createElement('a');
    downloadLink.download = `market_data_${new Date().getDate()}${new Date().getMonth() + 1}${new Date().getFullYear()}${new Date().getHours()}${new Date().getMinutes()}.csv`;
    downloadLink.href = window.URL.createObjectURL(new Blob([csv.join('\n')], { type: 'text/csv' }));
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  /**
   * Mengganti tampilan aktif antara 'traffic' (tabel saham) dan 'news' (berita pasar).
   * Memuat berita jika beralih ke tampilan 'news' dan berita belum dimuat.
   * @param {'traffic'|'news'} view - Tampilan yang akan diaktifkan.
   * @returns {void}
   */
  function switchView(view) {
    activeView.value = view;
    if (view === 'news' && marketNews.value.length === 0 && !newsLoading.value) {
      fetchMarketNews();
    }
  }

  // Lifecycle hooks
  onMounted(async () => {
    await fetchAllInitialData();
    
    if (activeView.value === 'news') fetchMarketNews();
  });

  onUnmounted(() => {
    if (socket.value) socket.value.close();
  });

  return {
    // Reactive data
    stockData,
    symbols,
    searchInput,
    searchResults,
    isSearching,
    showSearchResults,
    activeView,
    marketNews,
    newsLoading,
    modalVisible,
    selectedStock,
    
    // Methods
    formatMarketCap,
    getDisplayCode,
    searchSymbol,
    addStockToTable,
    showStockDetail,
    closeModal,
    downloadCSV,
    switchView,
  };
}
