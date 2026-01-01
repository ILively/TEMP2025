<script>
	import useStockFeatures from './UseStock.js'
	
	export default {
		name: 'MainPage',
		setup() {
			return { ...useStockFeatures() }
		},
	}
</script>

<template>
	<div class="container">
		<header class="navbar">
			<nav>
				<ul class="nav-list">
					<li class="nav-item active">
						<a href="#">Home</a>
					</li>
				</ul>
			</nav>
			<div class="app-logo">
				<span class="icon">󱤅</span>
				<span class="title">Saham Kita</span>
			</div>
		</header>
		
		<div class="toggle-switch-container">
			<button id="toggle-traffic" :class="['toggle-button', { 'active': activeView === 'traffic' }]" @click="switchView('traffic')">
				&emsp;MARKET
			</button>
			<button id="toggle-news" :class="['toggle-button', { 'active': activeView === 'news' }]" @click="switchView('news')">
				󰎕&emsp;NEWS
			</button>
		</div>
		
		<div id="main-content-area">
			<div id="traffic-view" v-show="activeView === 'traffic'">
				<div class="search-section">
					<div class="search-input-group">
						<input type="text" id="search-input" placeholder="Search for stock/crypto symbols (sample: NVDA, BTC/USD)" v-model="searchInput" @keypress.enter="searchSymbol" />
						<button class="search-btn" @click="searchSymbol" :disabled="isSearching">
							{{ isSearching ? '...': '' }}
						</button>
					</div>
					
					<div class="search-results" v-show="showSearchResults">
						<div v-if="isSearching" style="padding: 10px; color: #6c757d;">Searching...</div>
						<div v-else-if="searchResults.length === 0" style="padding: 10px; color: #6c757d;">
							No matching results found. Try a different symbol.
						</div>
						<div v-else>
							<div v-for="item in searchResults" :key="item.symbol" class="search-item">
								<div class="search-item-info">
									<div class="search-item-symbol">
										{{ getDisplayCode(item.symbol) }}
									</div>
									<div class="search-item-name">
										{{ item.description || item.symbol }}
									</div>
									<div class="search-item-name">
										{{ item.exchange }} • {{ item.type }}
									</div>
								</div>
								<button v-if="item.type !== 'Message'" :class="['add-btn', { 'active': !stockData[item.symbol] }]" :disabled="stockData[item.symbol]" @click="addStockToTable(item.symbol, item.description)">
									{{ stockData[item.symbol] ? 'Added' : 'Add' }}
								</button>
							</div>
						</div>
					</div>
				</div>
				
				<div class="table-wrapper">
					<table id="stock-table">
						<thead>
							<tr>
								<th style="width: 20px;">#</th>
								<th>Symbols</th>
								<th>Price ($)</th>
								<th>Open / High / Low</th>
								<th>Prev. Close / Traffic</th>
								<th style="text-align: right;">
									Change (24h)
								</th>
								<th style="text-align: right;">
									Market Capitalization
								</th>
								<th style="text-align: right;">
									Exchange
								</th>
								<th style="text-align: right;">
									IPO
								</th>
							</tr>
						</thead>
						<tbody>
							<tr v-if="symbols.length === 0">
								<td colspan="9" style="text-align: center; color: #4a5568;">
									Loading initial market data...
								</td>
							</tr>
							<tr v-for="(stock, index) in Object.values(stockData)" :key="stock.code" :id="`row-${stock.code}`" @click="showStockDetail(stock.code)" :class="['stock-row']">
								
								<td>{{ index + 1 }}</td>
								
								<td>
									<div class="stock-info">
										<img v-if="stock.logoUrl" :src="stock.logoUrl" class="stock-logo" :alt="stock.name" @error="e => e.target.src='https://placehold.co/40x40/f0f0f0/666?text=NO+LOGO'">
										<span v-else class="stock-logo">
											{{ getDisplayCode(stock.code).substring(0, 1) || '?' }}
										</span>
										<div>
											<div class="symbol-code">
												{{ getDisplayCode(stock.code) }}
											</div>
											<div class="symbol-name">
												{{ stock.name }}
											</div>
										</div>
									</div>
								</td>
								
								<td :class="['price-cell', `text-${stock.priceDirection}`]">
									${{ stock.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) }}
								</td>
								
								<td class="table-detail-group">
									<span class="detail-label">Open:</span> {{ stock.openPrice.toLocaleString('en-US') }}<br>
									<span class="detail-label">High:</span> {{ stock.highPrice.toLocaleString('en-US') }}<br>
									<span class="detail-label">Low:</span> {{ stock.lowPrice.toLocaleString('en-US') }}
								</td>
								<td>
									<span class="detail-label">P. Close:</span> {{ stock.prevClose.toLocaleString('en-US') }}<br>
									<span class="detail-label">T:</span>
									<span :class="['change-badge', {'up': stock.lastTradeVolume > 0, 'down': stock.lastTradeVolume < 0}]">
										<span class="nf">{{ stock.lastTradeVolume > 0 ? '' : (stock.lastTradeVolume < 0 ? '' : '') }}</span>
										{{ stock.lastTradeVolume.toLocaleString('id-ID') }}
									</span>
								</td>
								<td :class="['text-right', { 'change-up': stock.initialChangePercent >= 0, 'change-down': stock.initialChangePercent < 0 }]">
									<span class="nf">{{ stock.initialChangePercent >= 0 ? '' : '' }}</span>
									{{ Math.abs(stock.initialChangePercent).toFixed(2) }}%
								</td>
								
								<td class="text-right">
									{{ formatMarketCap(stock.marketCap) }}
								</td>
								<td class="text-right">
									{{ stock.exchange }}
								</td>
								<td class="text-right">
									{{ stock.ipoDate }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div class="table-footer-note">
					<div class="note-content">
						<span class="note-icon"></span>
						<div class="note-description">
							<p>
								Real-time Volume/Traffic here is the last trade size, does not support stock (IDN). <a href="#" @click.prevent="downloadCSV">[CSV]</a>
							</p>
						</div>
					</div>
				</div>
			</div>
			
			<div id="news-view" v-show="activeView === 'news'">
				<div id="news-section">
					<div v-if="newsLoading" style="text-align: center; color: #6c757d; padding: 50px 0;">
						Taking market news...
					</div>
					<div v-else-if="typeof marketNews === 'string'" style="text-align: center; color: #FF4A4A; padding: 50px 0;">
						{{ marketNews }}
					</div>
					<div v-else-if="marketNews.length > 0">
						<a v-for="news in marketNews" :key="news.id" :href="news.url" target="_blank" class="news-item">
							<img :src="news.image" class="news-item-image" @error="e => e.target.src='https://placehold.co/80x80/f0f0f0/666?text=NO+IMG'" :alt="news.headline">
							<div class="news-item-content">
								<h5>{{ news.headline }}</h5>
								<p>{{ news.summary }}</p>
								<span class="news-source">{{ news.source }} - {{ news.date }}</span>
							</div>
						</a>
					</div>
					<div v-else style="text-align: center; color: #FF4A4A; padding: 50px 0;">
						No news available.
					</div>
				</div>
			</div>
		</div>
		
		<div id="stock-detail-modal" class="modal" :style="{ display: modalVisible ? 'block' : 'none' }" @click.self="closeModal">
			<div class="modal-content" v-if="selectedStock">
				<span class="close-btn" @click="closeModal">󰁦</span>
				<div id="modal-details-content">
					<div class="modal-header">
						<img v-if="selectedStock.logoUrl" :src="selectedStock.logoUrl" class="modal-logo" :alt="selectedStock.name" @error="e => e.target.src='https://placehold.co/40x40/f0f0f0/666?text=NO+LOGO'">
						<span v-else class="modal-logo" style="line-height: 40px; font-size: 20px;">{{ getDisplayCode(selectedStock.code).substring(0, 1) }}</span>
						<div class="modal-symbol-info">
							<h3>{{ getDisplayCode(selectedStock.code) }}</h3>
							<p>{{ selectedStock.name }}</p>
						</div>
					</div>
					
					<div class="anim-show" style="--d: 0.1s;">
						<div class="detail-item">
							<span>Stock price</span>
							<span :class="`text-${selectedStock.priceDirection}`">
								${{ selectedStock.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) }}
							</span>
						</div>
						<div class="detail-item">
							<span>Change (24h)</span>
							<span :class="{'change-up': selectedStock.initialChangePercent >= 0, 'change-down': selectedStock.initialChangePercent < 0}">
								<span class="nf">{{ selectedStock.initialChangePercent >= 0 ? '' : '' }}</span>
								{{ selectedStock.initialChangePercent.toFixed(2) }}%
							</span>
						</div>
						
						<hr class="modal-separator">
						
						<div class="detail-item">
							<span>Open Price</span>
							<span>${{ selectedStock.openPrice.toLocaleString('en-US') }}</span>
						</div>
						<div class="detail-item">
							<span>High / Low (24h)</span>
							<span>${{ selectedStock.highPrice.toLocaleString('en-US') }} / ${{ selectedStock.lowPrice.toLocaleString('en-US') }}</span>
						</div>
						<div class="detail-item">
							<span>Previous Close</span>
							<span>${{ selectedStock.prevClose.toLocaleString('en-US') }}</span>
						</div>
						<div class="detail-item">
							<span>Last Volume</span>
							<span>{{ selectedStock.lastTradeVolume.toLocaleString('id-ID') }}</span>
						</div>
						
						<hr class="modal-separator">
						
						<div class="detail-item">
							<span>Market Capitalization</span>
							<span>
								{{ formatMarketCap(selectedStock.marketCap) }}
							</span>
						</div>
						<div class="detail-item">
							<span>Exchange</span>
							<span>{{ selectedStock.exchange }}</span>
						</div>
						<div class="detail-item">
							<span>Currency</span>
							<span>{{ selectedStock.currency }}</span>
						</div>
						<div class="detail-item">
							<span>IPO</span>
							<span>{{ selectedStock.ipoDate }}</span>
						</div>
						<div class="detail-item">
							<span>Data Source</span>
							<span style="color: #ff9f80;">FINNHUB</span>
						</div>
						<div class="detail-item">
							<span>Website</span>
							<span>
								<a v-if="selectedStock.webUrl && selectedStock.webUrl !== '#'" :href="selectedStock.webUrl" target="_blank">
									{{ selectedStock.webUrl.slice(0, 24) }}...
								</a>
								<template v-else>Not available</template>
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>