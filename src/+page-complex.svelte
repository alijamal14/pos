<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { itemsStore, loadFromDB, makeItem, applyOp, exportJSON, importJSON } from '$lib/state/items';
	import { generateToCanvas } from '$lib/qr/generate';
	import { startScanner } from '$lib/qr/scan';
	import { pushToast } from '$lib/ui/Toast.svelte';
	import { peerCount, peerStatus } from '$lib/stores/peers';
	import { peers as peersStore, setLocalPeerId, getAllPeers, disconnectPeer, allPeers } from '$lib/p2p/webrtc';
	import { runDiagnostics } from '$lib/utils/diagnostics';
	import { encodePayload, decodePayload } from '$lib/p2p/signaling';
	import { createOfferAndLocalize, createAnswerAndLocalize, applyRemoteAnswer, autoConnectToHost, processPendingConnections } from '$lib/p2p/webrtc';
	import { BUILD_INFO } from '$lib/build-info';
  
	let newText = '';
	let remoteOffer = '';
	let localOffer = '';
	let localAnswer = '';
	let connectionMode = '';
	let showConnectionFlow = false;
	let peerId = '';
	let currentConnectionCode = '';
	let autoConnectInterval: ReturnType<typeof setInterval> | null = null;

	$: items = $itemsStore;
	$: connectionStatus = $peerStatus;
	$: connectedPeers = Array.from($peersStore.entries()).filter(([_, peer]) => peer.dc?.readyState === 'open' && !!peer.remoteId);
	$: allNetworkPeers = Array.from($allPeers.values());
	$: isHost = connectionMode === 'host';
	$: console.log('🔄 UI Update - Connected peers:', connectedPeers.map(([id, peer]) => ({
		id: peer.remoteId,
		dcState: peer.dc?.readyState,
		dcExists: !!peer.dc
	})));
	
	// Regenerate QR code when localOffer changes
	$: if (localOffer && connectionMode === 'host') {
		// Use setTimeout to ensure DOM is updated
		setTimeout(() => {
			const el = document.getElementById('offerQR') as HTMLElement;
			if (el) {
				console.log('🎨 Generating QR code for offer:', localOffer.substring(0, 50) + '...');
				generateToCanvas(el, localOffer).catch(console.error);
			} else {
				console.warn('⚠️ offerQR element not found');
			}
		}, 100);
	}

	onMount(async () => {
		await loadFromDB();
		// Generate unique peer ID
		peerId = Math.random().toString(36).slice(2, 8);
		setLocalPeerId(peerId);
	});

	onDestroy(() => {
		stopAutoConnectionMonitoring();
	});

	// Diagnostic function for testing - available in browser console
	(globalThis as any).testP2PFlow = async () => {
		console.log('🧪 Starting P2P diagnostic test...');
		
		try {
			// Test 1: Generate connection code
			console.log('📤 Test 1: Generating connection code...');
			const connectionCode = await createOfferAndLocalize();
			console.log('✅ Connection code generated:', connectionCode);
			
			// Test 2: Test decoding the same code
			console.log('📥 Test 2: Testing decode of generated code...');
			const decoded = decodePayload(connectionCode);
			console.log('✅ Decoded result:', decoded);
			
			// Test 3: Test auto-connect with the code
			console.log('🚀 Test 3: Testing auto-connect...');
			try {
				await autoConnectToHost(connectionCode);
				console.log('✅ Auto-connect test passed');
			} catch (e) {
				console.error('❌ Auto-connect test failed:', e);
			}
			
			console.log('🧪 Diagnostic test completed');
			return { success: true, connectionCode, decoded };
			
		} catch (error) {
			console.error('❌ Diagnostic test failed:', error);
			return { success: false, error: error.message };
		}
	};

	// Simple QR test function
	(globalThis as any).testQRScan = (testCode: string) => {
		console.log('🎯 Testing QR scan with code:', testCode);
		onScanOffer();
		// Simulate scan result
		setTimeout(() => {
			console.log('📱 Simulating scan result...');
			try {
				const decoded = decodePayload(testCode);
				console.log('✅ Decode successful:', decoded);
			} catch (e) {
				console.error('❌ Decode failed:', e);
			}
		}, 1000);
	};

	function addItem(){
		if (!newText.trim()) return;
		const it = makeItem(newText.trim());
		applyOp({ type: 'upsert', item: it });
		newText = '';
		pushToast('Item added', 'success');
	}


	async function onCreateOffer(){
		try {
			// Clear previous offer to ensure UI updates
			localOffer = '';
			
			const connectionCode = await createOfferAndLocalize();
			localOffer = connectionCode;
			currentConnectionCode = connectionCode;
			
			console.log('📡 Generated connection code:', connectionCode);
			
			// Generate QR code after a short delay
			setTimeout(async () => {
				const el = document.getElementById('offerQR') as HTMLElement;
				if (el) {
					console.log('🎨 Generating QR code for simple code...');
					await generateToCanvas(el, connectionCode);
				}
			}, 200);
			
			// Start checking for auto-connections
			startAutoConnectionMonitoring();
			
			pushToast('Connection code ready! Others can scan and auto-connect.', 'success');
		} catch (e) { 
			console.error('Offer creation error:', e);
			pushToast('Failed to generate connection code', 'error'); 
		}
	}

	function startAutoConnectionMonitoring() {
		// Clear any existing interval
		if (autoConnectInterval) {
			clearInterval(autoConnectInterval);
		}
		
		// Check for pending connections every 2 seconds
		autoConnectInterval = setInterval(async () => {
			if (currentConnectionCode) {
				try {
					const connected = await processPendingConnections(currentConnectionCode);
					if (connected > 0) {
						pushToast(`${connected} device(s) connected automatically!`, 'success');
					}
				} catch (error) {
					console.error('Error checking connections:', error);
				}
			}
		}, 2000);
	}

	function stopAutoConnectionMonitoring() {
		if (autoConnectInterval) {
			clearInterval(autoConnectInterval);
			autoConnectInterval = null;
		}
	}

	function copyOffer() {
		const textToCopy = localAnswer || localOffer;
		if (textToCopy) {
			navigator.clipboard.writeText(textToCopy);
			console.log('📋 Copied connection code:', textToCopy.substring(0, 50) + '...');
			pushToast('Code copied to clipboard!', 'success');
		}
	}


		async function onCreateAnswer(){
			try {
				// Check if we have a remote offer
				if (!remoteOffer.trim()) {
					throw new Error('Please enter the connection code first');
				}

				// Parse the offer from remoteOffer
				const offerObj = decodePayload(remoteOffer.trim());
				if (!offerObj.sdp) {
					throw new Error('Invalid connection code format');
				}

				console.log('Creating response for connection code:', offerObj.sdp.type);
				const simpleAnswerCode = await createAnswerAndLocalize(offerObj.sdp);
				localAnswer = simpleAnswerCode;
				
				const el = document.getElementById('answerQR') as HTMLElement;
				if (el) await generateToCanvas(el, simpleAnswerCode);
				pushToast('Response code generated! Share it back with the host.', 'success');
				
				// Clear the remote offer so we can handle new offers
				remoteOffer = '';
			} catch (e) {
				console.error('Create answer error:', e);
				const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
				pushToast(`Failed to generate response: ${errorMessage}`, 'error');
			}
		}

	async function onScanOffer(){
		startScanner(async (text) => {
			console.log('🎯 QR Scan successful:', text);
			
			// Always set the scanned text for manual fallback
			remoteOffer = text;
			
			// Try to decode and handle automatically
			try {
				const decoded = decodePayload(text);
				console.log('✅ Decoded successfully:', decoded);
				
				if (decoded.sdp) {
					// Auto-generate response immediately
					console.log('� Auto-generating response...');
					const answerDesc = await createAnswerAndLocalize(decoded.sdp);
					const encoded = encodePayload({ sdp: JSON.parse(answerDesc).sdp });
					localAnswer = encoded;
					
					// Show response QR code
					const el = document.getElementById('answerQR') as HTMLElement;
					if (el) await generateToCanvas(el, encoded);
					
					pushToast('✅ Connected! Response generated automatically.', 'success');
					
					// Auto-apply if host has auto-apply enabled
					if (decoded.autoConnect) {
						setTimeout(async () => {
							try {
								await applyRemoteAnswer(JSON.parse(answerDesc).sdp);
								pushToast('🎉 Auto-connection completed!', 'success');
								connectionMode = '';
								showConnectionFlow = false;
							} catch (e) {
								console.log('Host will apply manually');
							}
						}, 1000);
					}
				} else {
					pushToast('⚠️ Invalid code format. Try manual entry.', 'warning');
				}
				
			} catch (error) {
				console.error('❌ Auto-processing failed:', error);
				pushToast(`📱 Code scanned: ${text.substring(0, 8)}... (Ready for manual connection)`, 'info');
			}
		});
	}


	async function onApplyAnswer(){
		try {
			const parsed = decodePayload(localAnswer.trim() || remoteOffer.trim());
			if (!parsed.sdp) throw new Error('No SDP in answer');
			await applyRemoteAnswer(parsed.sdp);
			pushToast('Answer applied', 'success');
			// Clear the offer and answer fields after successful connection
			localOffer = '';
			localAnswer = '';
		} catch (e) {
			console.error('Apply answer error:', e);
			pushToast('Failed to apply answer', 'error');
		}
	}	async function doExport(){
		const json = await exportJSON();
		const blob = new Blob([json], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob); a.download = 'p2p-items.json'; a.click();
		pushToast('Exported JSON', 'info');
	}

	function runDiag(){ runDiagnostics(); pushToast('Diagnostics printed to console', 'info'); }

	function disconnectPeerById(peerId: string) {
		try {
			const success = disconnectPeer(peerId);
			if (success) {
				pushToast(`Disconnected peer ${peerId}`, 'success');
			} else {
				pushToast(`Failed to disconnect peer ${peerId}`, 'error');
			}
		} catch (e) {
			console.error('Failed to disconnect peer:', e);
			pushToast('Failed to disconnect peer', 'error');
		}
	}
</script>

<div class="p-6 min-h-screen bg-gradient-to-br from-[#0b1020] via-[#0b1530] to-[#0a1130] text-white">
	<div class="max-w-4xl mx-auto grid gap-6">
		<div class="bg-[#121937] p-4 rounded-xl shadow-lg flex justify-between items-center">
			<div>
				<h1 class="text-xl font-bold">P2P Items (No Server)</h1>
				<div class="text-sm text-slate-300">Local-first list that syncs peer-to-peer via WebRTC</div>
				<div class="text-xs text-slate-400 mt-1">
					v{BUILD_INFO.version} • Build {BUILD_INFO.buildNumber}
				</div>
			</div>
			<div class="text-sm">
				<span class="px-3 py-1 rounded-full bg-[#1a2249]">Peer ID: {peerId}</span>
			</div>
		</div>

		<div class="grid md:grid-cols-2 gap-6">
			<div class="bg-[#121937] p-4 rounded-xl">
				<h2 class="uppercase text-sm mb-2 text-slate-300">Items</h2>
				<div class="flex gap-2 mb-3">
					<input bind:value={newText} placeholder="Add a new item…" class="flex-1 rounded-md p-2 bg-[#0f1530] border border-[#2c3978]" />
					<button on:click={addItem} class="px-3 py-2 rounded-md bg-[#1b7a61]">Add</button>
				</div>
				<div class="space-y-2">
									{#each Object.values(items) as it}
										{#if !it.deleted}
											<div class="p-3 bg-[#0f1530] rounded-md flex justify-between items-center">
												<div>
													<div class="font-medium">{it.text}</div>
													<div class="text-xs text-slate-400">{it.updatedAt}</div>
												</div>
												<div class="flex gap-2">
													<button class="px-2 py-1 bg-[#e11d48] rounded-md text-white hover:bg-[#be123c]" on:click={() => applyOp({ type: 'delete', id: it.id })}>🗑️ Delete</button>
												</div>
											</div>
										{/if}
									{/each}
				</div>
			</div>

			<div class="bg-[#121937] p-4 rounded-xl">
				<h2 class="uppercase text-sm mb-4 text-slate-300">🔗 Connect with Another Device</h2>
				
				<!-- Step 1: Choose your role -->
				<div class="mb-6">
					<div class="text-sm text-slate-400 mb-3">Step 1: Choose how to connect</div>
					<div class="grid grid-cols-2 gap-3">
						<button 
							on:click={() => { connectionMode = 'host'; showConnectionFlow = true; }}
							class="p-3 bg-[#1a2249] hover:bg-[#2a3570] rounded-lg text-center transition-colors"
							class:bg-[#2a3570]={connectionMode === 'host'}
						>
							<div class="text-lg mb-1">🏠</div>
							<div class="text-sm font-medium">Host Session</div>
							<div class="text-xs text-slate-400">Create invitation</div>
						</button>
						<button 
							on:click={() => { connectionMode = 'join'; showConnectionFlow = true; }}
							class="p-3 bg-[#1a2249] hover:bg-[#2a3570] rounded-lg text-center transition-colors"
							class:bg-[#2a3570]={connectionMode === 'join'}
						>
							<div class="text-lg mb-1">📱</div>
							<div class="text-sm font-medium">Join Session</div>
							<div class="text-xs text-slate-400">Use invitation</div>
						</button>
					</div>
				</div>

				<!-- Connection Flow -->
				{#if showConnectionFlow}
					<div class="border-t border-[#2c3978] pt-4">
						{#if connectionMode === 'host'}
							<!-- Host Flow -->
							<div class="space-y-4">
								<div class="flex items-center text-sm">
									<div class="w-6 h-6 bg-[#1b7a61] rounded-full flex items-center justify-center text-xs font-bold mr-3">1</div>
									<span class="text-slate-300">Generate connection codes for joiners</span>
								</div>
								
								<div class="space-y-3">
									<button on:click={onCreateOffer} class="w-full px-4 py-3 bg-[#1b7a61] hover:bg-[#2a8a71] rounded-lg font-medium transition-colors">
										🚀 Generate New Connection Code
									</button>
									
									{#if localOffer}
										<div class="space-y-3">
											<div class="flex items-center text-sm text-green-400">
												<div class="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">✓</div>
												<span>Connection code ready!</span>
											</div>
											
											<div class="bg-[#0f1530] p-3 rounded-lg">
												<div class="text-xs text-slate-400 mb-2">Share this simple connection code:</div>
												<div id="offerQR" class="flex justify-center mb-3"></div>
												<div class="flex gap-2">
													<input class="flex-1 rounded-md p-3 bg-[#0a0f20] border border-[#2c3978] text-lg font-mono text-center tracking-widest" readonly value={localOffer} />
													<button class="px-3 py-2 bg-[#2563eb] rounded-md" on:click={copyOffer}>📋 Copy</button>
												</div>
												<div class="text-xs text-slate-400 mt-2 text-center">
													Easy to type: just {localOffer?.length || 0} characters!
												</div>
											</div>
										</div>
									{/if}
									
									<div class="text-xs text-slate-400 mt-2">
										Simple one-scan connection: Share this code or QR. Others scan once to auto-connect!
									</div>
								</div>
								
								<div class="flex items-center text-sm">
									<div class="w-6 h-6 bg-[#2a3570] rounded-full flex items-center justify-center text-xs font-bold mr-3">2</div>
									<span>Apply response codes from joiners</span>
								</div>
								
								<div class="bg-[#0f1530] p-3 rounded-lg">
									<div class="text-xs text-slate-400 mb-2">Paste simple response code from any joiner:</div>
									<div class="flex gap-2">
										<input 
											bind:value={localAnswer} 
											placeholder="Enter 6-character response code..." 
											class="flex-1 rounded-md p-3 bg-[#0a0f20] border border-[#2c3978] text-lg font-mono text-center tracking-widest uppercase" 
											maxlength="8"
											style="text-transform: uppercase;"
										/>
										<button on:click={onApplyAnswer} class="px-3 py-2 bg-[#1b7a61] rounded-md">✅ Apply</button>
									</div>
								</div>
							</div>
						{:else}
							<!-- Join Flow -->
							<div class="space-y-4">
								<div class="flex items-center text-sm">
									<div class="w-6 h-6 bg-[#1b7a61] rounded-full flex items-center justify-center text-xs font-bold mr-3">1</div>
									<span class="text-slate-300">Enter the connection code</span>
								</div>
								
								<div class="space-y-3">
									<div class="flex gap-2">
										<input 
											bind:value={remoteOffer} 
											placeholder="Enter connection code or scan QR" 
											class="flex-1 rounded-md p-3 bg-[#0f1530] border border-[#2c3978] text-lg font-mono text-center tracking-widest uppercase" 
											maxlength="8"
											style="text-transform: uppercase;"
										/>
										<button on:click={onScanOffer} class="px-4 py-3 bg-[#2a3570] rounded-md" title="Scan QR to Auto-Connect">📷</button>
									</div>
									<div class="text-xs text-slate-400 mt-2 text-center">
										Scan QR code for instant connection, or type the code manually
									</div>
									
									{#if remoteOffer}
										<div class="flex items-center text-sm text-green-400">
											<div class="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">✓</div>
											<span>Code received!</span>
										</div>
										
										<div class="flex items-center text-sm">
											<div class="w-6 h-6 bg-[#1b7a61] rounded-full flex items-center justify-center text-xs font-bold mr-3">2</div>
											<span class="text-slate-300">Generate response code</span>
										</div>
										
										<button on:click={onCreateAnswer} class="w-full px-4 py-3 bg-[#1b7a61] hover:bg-[#2a8a71] rounded-lg font-medium transition-colors">
											� Generate Response Code
										</button>
										
										{#if localAnswer}
											<div class="space-y-3">
												<div class="flex items-center text-sm text-green-400">
													<div class="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">✓</div>
													<span>Response code ready!</span>
												</div>
												
												<div class="bg-[#0f1530] p-3 rounded-lg">
													<div class="text-xs text-slate-400 mb-2">Share this simple response code back:</div>
													<div id="answerQR" class="flex justify-center mb-3"></div>
													<div class="flex gap-2">
														<input class="flex-1 rounded-md p-3 bg-[#0a0f20] border border-[#2c3978] text-lg font-mono text-center tracking-widest" readonly value={localAnswer} />
														<button class="px-3 py-2 bg-[#2563eb] rounded-md" on:click={() => navigator.clipboard.writeText(localAnswer)}>📋 Copy</button>
													</div>
													<div class="text-xs text-slate-400 mt-2 text-center">
														Easy to type: just {localAnswer?.length || 0} characters!
													</div>
												</div>
											</div>
										{/if}
									{/if}
								</div>
							</div>
						{/if}
						
						<!-- Successfully Connected Peers -->
						{#if allNetworkPeers.length > 0}
							<div class="mt-4 pt-4 border-t border-[#2c3978]">
								<div class="text-sm text-slate-400 mb-3">Successfully Connected Peers ({allNetworkPeers.length}):</div>
								<div class="space-y-2">
									{#each allNetworkPeers as peer}
										<div class="flex items-center justify-between bg-[#0f1530] p-3 rounded-lg">
											<div class="flex items-center">
												<span class="inline-block w-3 h-3 bg-green-500 rounded-full mr-3"></span>
												<div>
													<div class="font-mono text-sm font-medium">{peer.id}</div>
													<div class="text-xs text-slate-400">
														{#if peer.isHost}
															Host • Connected {peer.connectedAt ? new Date(peer.connectedAt).toLocaleTimeString() : ''}
														{:else}
															Peer • Connected {peer.connectedAt ? new Date(peer.connectedAt).toLocaleTimeString() : ''}
														{/if}
													</div>
												</div>
											</div>
											{#if isHost && !peer.isHost}
												<button 
													class="px-3 py-2 bg-[#e11d48] hover:bg-[#be123c] rounded-md text-white text-sm transition-colors"
													on:click={() => disconnectPeerById(peer.id)}
													title="Disconnect this peer"
												>
													🔌 Disconnect
												</button>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Network Peers Section (Always Visible) -->
		{#if allNetworkPeers.length > 0}
			<div class="bg-[#121937] p-4 rounded-xl">
				<h2 class="uppercase text-sm mb-4 text-slate-300">🌐 Successfully Connected Peers</h2>
				<div class="grid gap-3">
					{#each allNetworkPeers as peer}
						<div class="flex items-center justify-between bg-[#0f1530] p-3 rounded-lg">
							<div class="flex items-center">
								<span class="inline-block w-3 h-3 bg-green-500 rounded-full mr-3"></span>
								<div>
									<div class="font-mono text-sm font-medium">{peer.id}</div>
									<div class="text-xs text-slate-400">
										{#if peer.isHost}
											Host • Connected {peer.connectedAt ? new Date(peer.connectedAt).toLocaleTimeString() : ''}
										{:else}
											Peer • Connected {peer.connectedAt ? new Date(peer.connectedAt).toLocaleTimeString() : ''}
										{/if}
									</div>
								</div>
							</div>
							{#if isHost && !peer.isHost}
								<button 
									class="px-3 py-2 bg-[#e11d48] hover:bg-[#be123c] rounded-md text-white text-sm transition-colors"
									on:click={() => disconnectPeerById(peer.id)}
									title="Disconnect this peer"
								>
									🔌 Disconnect
								</button>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="bg-[#121937] p-4 rounded-xl">
			<h2 class="uppercase text-sm mb-2 text-slate-300">Debug</h2>
			<div class="flex gap-2">
				<button on:click={doExport} class="px-3 py-2 bg-[#2a3570] rounded-md">Export JSON</button>
				<button on:click={() => document.getElementById('filePick')?.click()} class="px-3 py-2 bg-[#2a3570] rounded-md">Import JSON</button>
				<button on:click={runDiag} class="px-3 py-2 bg-[#2563eb] rounded-md">🔧 Run Diagnostics</button>
				<input id="filePick" type="file" hidden on:change={async (e)=>{ const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return; const t = await f.text(); await importJSON(t); pushToast('Imported JSON','info'); }} accept="application/json" />
			</div>
		</div>

	</div>

</div>
