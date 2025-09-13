<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { itemsStore, loadFromDB, makeItem, applyOp, setWebRTCManager } from '$lib/state/items';
	import { peersStore } from '$lib/state/peers';
	import { getWebRTCManager } from '$lib/p2p/webrtc-simple';
	import { generateToCanvas } from '$lib/qr/generate';
	import { startScanner } from '$lib/qr/scan';
	import { pushToast } from '$lib/ui/Toast.svelte';
	import { BUILD_INFO, getBuildSummary, getDetailedBuildInfo } from '$lib/build-info';
  
	let newText = '';
	let connectionCode = '';
	let isHost = false;
	let isScanning = false;
	let showAdvanced = false;
	let manualCode = '';
	let showDetailedBuild = false;
	let autoCheckInterval: number | null = null;

	$: items = $itemsStore;
	$: peers = $peersStore;
	$: connectedPeers = Object.values(peers).filter(p => p.connected);
	
	const webRTC = getWebRTCManager();

	onMount(async () => {
		await loadFromDB();
		// Connect the WebRTC manager to items store
		setWebRTCManager(webRTC);
	});

	function addItem() {
		if (!newText.trim()) return;
		const item = makeItem(newText.trim());
		applyOp({ type: 'upsert', item: item });
		newText = '';
		pushToast('Item added', 'success');
	}

	function deleteItem(id: string) {
		applyOp({ type: 'delete', id });
		pushToast('Item deleted', 'success');
	}

	async function createConnection() {
		try {
			console.log('🚀 Creating new connection...');
			connectionCode = await webRTC.createOffer();
			console.log('✅ Connection code generated:', connectionCode);
			isHost = true;
			
			// Generate QR code
			setTimeout(() => {
				const qrEl = document.getElementById('qrCode');
				if (qrEl) {
					console.log('📱 Generating QR code for:', connectionCode);
					generateToCanvas(qrEl, connectionCode).catch(console.error);
				}
			}, 100);
			
			// Start polling for answers
			startAnswerPolling();
			
			pushToast('Connection ready! Share this 4-character code: ' + connectionCode, 'success');
		} catch (error) {
			console.error('Failed to create connection:', error);
			pushToast('Failed to create connection', 'error');
		}
	}

	function startAnswerPolling() {
		if (autoCheckInterval) {
			clearInterval(autoCheckInterval);
		}
		
		autoCheckInterval = window.setInterval(async () => {
			if (!connectionCode || !isHost) {
				return;
			}
			
			try {
				const hasAnswer = await webRTC.checkForAnswer(connectionCode);
				if (hasAnswer) {
					pushToast('Device connected automatically!', 'success');
					// Keep polling for more connections
				}
			} catch (error) {
				console.error('Error checking for answer:', error);
			}
		}, 2000);
	}

	function stopAnswerPolling() {
		if (autoCheckInterval) {
			clearInterval(autoCheckInterval);
			autoCheckInterval = null;
		}
	}

	async function startScan() {
		if (isScanning) return;
		
		try {
			isScanning = true;
			pushToast('Starting camera...', 'info');
			
			const result = await startScanner();
			console.log('🔍 Scanned QR result:', result);
			console.log('🔍 Trimmed result:', result.trim());
			console.log('🔍 Result length:', result.trim().length);
			
			// Validate the scanned code before trying to connect
			const cleanCode = result.trim();
			if (!cleanCode) {
				throw new Error('Empty QR code result');
			}
			
			if (cleanCode.length === 4 && /^[A-Z0-9]{4}$/.test(cleanCode)) {
				console.log('✅ Valid 4-character connection ID detected');
			} else if (cleanCode.length > 50) {
				console.log('📝 Long content detected, assuming full SDP');
			} else {
				console.log('⚠️ Unusual code format:', cleanCode);
			}
			
			// Try to connect using scanned code
			const response = await webRTC.acceptOffer(cleanCode);
			pushToast('Connected! ' + response, 'success');
			
		} catch (error) {
			console.error('Scan failed:', error);
			pushToast('Scan failed: ' + (error as Error).message, 'error');
		} finally {
			isScanning = false;
		}
	}

	async function joinManually() {
		if (!manualCode.trim()) {
			pushToast('Please enter a connection code', 'error');
			return;
		}
		
		try {
			const response = await webRTC.acceptOffer(manualCode.trim());
			pushToast('Connected! ' + response, 'success');
		} catch (error) {
			console.error('Manual join failed:', error);
			pushToast('Join failed: ' + (error as Error).message, 'error');
		}
	}

	async function applyAnswer() {
		if (!manualCode.trim()) {
			pushToast('Please enter an answer code', 'error');
			return;
		}
		
		try {
			await webRTC.handleAnswer(manualCode.trim());
			pushToast('Answer applied! Connection should be established.', 'success');
		} catch (error) {
			console.error('Apply answer failed:', error);
			pushToast('Failed to apply answer: ' + (error as Error).message, 'error');
		}
	}

	function copyCode() {
		if (connectionCode) {
			navigator.clipboard.writeText(connectionCode);
			pushToast('Code copied to clipboard!', 'success');
		}
	}

	function disconnect() {
		stopAnswerPolling();
		webRTC.disconnect();
		isHost = false;
		connectionCode = '';
		pushToast('Disconnected from all peers', 'info');
	}

	// Cleanup on component destroy
	onDestroy(() => {
		stopAnswerPolling();
	});
</script>

<div class="container mx-auto p-4 max-w-4xl">
	<header class="mb-8">
		<h1 class="text-3xl font-bold text-gray-800 mb-2">P2P Items List</h1>
		<p class="text-gray-600">Local-first collaborative items with WebRTC</p>
		<div class="text-sm text-gray-500 mt-2">
			<div class="flex items-center gap-4">
				<button 
					on:click={() => showDetailedBuild = !showDetailedBuild}
					class="hover:text-gray-700 transition-colors cursor-pointer"
					title="Click for detailed build info"
				>
					{getBuildSummary()} | Connected: {connectedPeers.length}
				</button>
			</div>
			{#if showDetailedBuild}
				<div class="mt-2 p-3 bg-gray-50 rounded-lg border text-xs font-mono whitespace-pre-line">
					{getDetailedBuildInfo()}
				</div>
			{/if}
		</div>
	</header>

	<!-- Connection Status -->
	{#if connectedPeers.length > 0}
		<div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
			<h3 class="text-sm font-semibold text-green-800 mb-2">Connected Peers ({connectedPeers.length})</h3>
			<div class="flex flex-wrap gap-2">
				{#each connectedPeers as peer}
					<span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">{peer.id}</span>
				{/each}
			</div>
			<button on:click={disconnect} class="mt-2 text-sm text-red-600 hover:text-red-800">
				Disconnect All
			</button>
		</div>
	{/if}

	<!-- Connection Controls -->
	<div class="mb-8 p-4 bg-gray-50 rounded-lg">
		<h2 class="text-xl font-semibold mb-4">Connect Devices</h2>
		
		{#if !connectionCode}
			<div class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<button 
						on:click={createConnection}
						class="w-full bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors"
					>
						📡 Host Connection
					</button>
					
					<button 
						on:click={startScan}
						disabled={isScanning}
						class="w-full bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-400"
					>
						{isScanning ? '📷 Scanning...' : '📷 Scan QR Code'}
					</button>
				</div>
				
				<div>
					<button 
						on:click={() => showAdvanced = !showAdvanced}
						class="text-sm text-gray-600 hover:text-gray-800"
					>
						{showAdvanced ? '↑' : '↓'} Manual Connection
					</button>
				</div>
				
				{#if showAdvanced}
					<div class="mt-4 p-4 bg-white border rounded">
						<div class="space-y-3">
							<div>
								<label for="manualCode" class="block text-sm font-medium mb-1">4-Character Connection Code:</label>
								<input 
									id="manualCode"
									bind:value={manualCode}
									placeholder="Enter 4-character code (e.g. AB12)..."
									maxlength="4"
									class="w-full p-2 border rounded text-sm uppercase"
									style="text-transform: uppercase"
								>
							</div>
							<div class="flex gap-2">
								<button 
									on:click={joinManually}
									class="px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600"
								>
									Connect to Host
								</button>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="text-center">
				<div class="mb-4">
					{#if isHost}
						<h3 class="text-lg font-semibold text-blue-800 mb-2">🔗 Hosting Connection</h3>
						<p class="text-sm text-gray-600 mb-4">Share this simple 4-character code: <strong class="text-lg font-mono">{connectionCode}</strong></p>
						
						<div class="flex justify-center mb-4">
							<div id="qrCode" class="border-2 border-gray-300 p-4 rounded-lg bg-white"></div>
						</div>
					{:else}
						<h3 class="text-lg font-semibold text-green-800 mb-2">✅ Connected as Client</h3>
						<p class="text-sm text-gray-600 mb-4">Connection established! You should see real-time sync now.</p>
					{/if}
				</div>
				
				<div class="mb-4">
					<div class="flex gap-2">
						<input 
							value={connectionCode}
							readonly
							class="flex-1 p-2 border rounded text-sm bg-gray-50 font-mono"
						>
						<button 
							on:click={copyCode}
							class="px-3 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
						>
							📋 Copy
						</button>
					</div>
				</div>
				
				<button 
					on:click={() => { connectionCode = ''; isHost = false; }}
					class="text-sm text-gray-600 hover:text-gray-800"
				>
					↶ Back to Connection Options
				</button>
			</div>
		{/if}
	</div>

	<!-- Add Item -->
	<div class="mb-6">
		<div class="flex gap-2">
			<input 
				bind:value={newText}
				on:keydown={(e) => e.key === 'Enter' && addItem()}
				placeholder="Add new item..."
				class="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
			>
			<button 
				on:click={addItem}
				class="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
			>
				Add
			</button>
		</div>
	</div>

	<!-- Items List -->
	<div class="space-y-3">
		{#each Object.values(items).filter(item => !item.deleted).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')) as item}
			<div class="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
				<div class="flex-1">
					<div class="text-gray-800">{item.text}</div>
					<div class="text-xs text-gray-500 mt-1">
						{new Date(item.updatedAt).toLocaleString()}
						{#if item.author}
							• by {item.author}
						{/if}
					</div>
				</div>
				<button 
					on:click={() => deleteItem(item.id)}
					class="ml-4 px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
				>
					Delete
				</button>
			</div>
		{:else}
			<div class="text-center text-gray-500 py-8">
				No items yet. Add your first item above!
			</div>
		{/each}
	</div>
</div>

<style>
	:global(body) {
		background-color: #f7fafc;
	}
</style>