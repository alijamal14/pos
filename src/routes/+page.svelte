<script lang="ts">
	import { onMount } from 'svelte';
	import { itemsStore, loadFromDB, makeItem, applyOp, exportJSON, importJSON } from '$lib/state/items';
	import { generateToCanvas } from '$lib/qr/generate';
	import { startScanner } from '$lib/qr/scan';
	import { pushToast } from '$lib/ui/Toast.svelte';
	import { peerCount, peerStatus } from '$lib/stores/peers';
	import { peers as peersStore, setLocalPeerId } from '$lib/p2p/webrtc';
	import { runDiagnostics } from '$lib/utils/diagnostics';
	import { encodePayload, decodePayload } from '$lib/p2p/signaling';
	import { createOfferAndLocalize, createAnswerAndLocalize, applyRemoteAnswer } from '$lib/p2p/webrtc';
  
	let newText = '';
	let remoteOffer = '';
	let localOffer = '';
	let localAnswer = '';
	let connectionMode = '';
	let showConnectionFlow = false;
	let peerId = '';

	$: items = $itemsStore;
	$: connectionStatus = $peerStatus;
	$: connectedPeers = Array.from($peersStore.entries()).filter(([_, peer]) => peer.dc?.readyState === 'open' && !!peer.remoteId);
	$: console.log('🔄 UI Update - Connected peers:', connectedPeers.map(([id, peer]) => ({
		id: peer.remoteId,
		dcState: peer.dc?.readyState,
		dcExists: !!peer.dc
	})));

	onMount(async () => {
		await loadFromDB();
		// Generate unique peer ID
		peerId = Math.random().toString(36).slice(2, 8);
		setLocalPeerId(peerId);
	});

	function addItem(){
		if (!newText.trim()) return;
		const it = makeItem(newText.trim());
		applyOp({ type: 'upsert', item: it });
		newText = '';
		pushToast('Item added', 'success');
	}


	async function onCreateOffer(){
		try {
			const desc = await createOfferAndLocalize();
			const encoded = encodePayload({ sdp: desc });
			localOffer = encoded;
			const el = document.getElementById('offerQR') as HTMLElement;
			if (el) await generateToCanvas(el, encoded);
			pushToast('Connection code generated! Share it with another device.', 'success');
		} catch (e) { 
			console.error('Offer creation error:', e);
			pushToast('Failed to generate connection code', 'error'); 
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
				const offerObj = decodePayload(remoteOffer);
				if (!offerObj.sdp) {
					throw new Error('Invalid connection code format');
				}

				console.log('Creating response for connection code:', offerObj.sdp.type);
				const answerDesc = await createAnswerAndLocalize(offerObj.sdp);
				const encoded = encodePayload({ sdp: answerDesc });
				localAnswer = encoded;
				const el = document.getElementById('answerQR') as HTMLElement;
				if (el) await generateToCanvas(el, encoded);
				pushToast('Response code generated! Share it back with the host.', 'success');
			} catch (e) {
				console.error('Create answer error:', e);
				const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
				pushToast(`Failed to generate response: ${errorMessage}`, 'error');
			}
		}

	async function onScanOffer(){
		startScanner((text) => {
			remoteOffer = text;
			pushToast('Scanned offer', 'success');
		});
	}


		async function onApplyAnswer(){
			try {
				const parsed = decodePayload(localAnswer || remoteOffer);
				if (!parsed.sdp) throw new Error('No SDP in answer');
				await applyRemoteAnswer(parsed.sdp);
				pushToast('Answer applied', 'success');
			} catch (e) {
				pushToast('Failed to apply answer', 'error');
			}
		}

	async function doExport(){
		const json = await exportJSON();
		const blob = new Blob([json], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob); a.download = 'p2p-items.json'; a.click();
		pushToast('Exported JSON', 'info');
	}

	function runDiag(){ runDiagnostics(); pushToast('Diagnostics printed to console', 'info'); }
</script>

<div class="p-6 min-h-screen bg-gradient-to-br from-[#0b1020] via-[#0b1530] to-[#0a1130] text-white">
	<div class="max-w-4xl mx-auto grid gap-6">
		<div class="bg-[#121937] p-4 rounded-xl shadow-lg flex justify-between items-center">
			<div>
				<h1 class="text-xl font-bold">P2P Items (No Server)</h1>
				<div class="text-sm text-slate-300">Local-first list that syncs peer-to-peer via WebRTC</div>
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
									<span class="text-slate-300">Generate your connection code</span>
								</div>
								
								{#if !localOffer}
									<button on:click={onCreateOffer} class="w-full px-4 py-3 bg-[#1b7a61] hover:bg-[#2a8a71] rounded-lg font-medium transition-colors">
										🚀 Generate Connection Code
									</button>
								{:else}
									<div class="space-y-3">
										<div class="flex items-center text-sm text-green-400">
											<div class="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold mr-3">✓</div>
											<span>Connection code ready!</span>
										</div>
										
										<div class="bg-[#0f1530] p-3 rounded-lg">
											<div class="text-xs text-slate-400 mb-2">Share this code with the other device:</div>
											<div id="offerQR" class="flex justify-center mb-3"></div>
											<div class="flex gap-2">
												<input class="flex-1 rounded-md p-2 bg-[#0a0f20] border border-[#2c3978] text-xs font-mono" readonly value={localOffer} />
												<button class="px-3 py-2 bg-[#2563eb] rounded-md" on:click={copyOffer}>📋 Copy</button>
											</div>
										</div>
										
										<div class="flex items-center text-sm">
											<div class="w-6 h-6 bg-[#2a3570] rounded-full flex items-center justify-center text-xs font-bold mr-3">2</div>
											<span>Waiting for response code...</span>
										</div>
										
										<div class="bg-[#0f1530] p-3 rounded-lg">
											<div class="text-xs text-slate-400 mb-2">Paste the response code from the joining device:</div>
											<div class="flex gap-2">
												<input 
													bind:value={localAnswer} 
													placeholder="Paste response code here..." 
													class="flex-1 rounded-md p-2 bg-[#0a0f20] border border-[#2c3978] text-xs font-mono" 
												/>
												<button on:click={onApplyAnswer} class="px-3 py-2 bg-[#1b7a61] rounded-md">✅ Apply</button>
											</div>
										</div>
									</div>
								{/if}
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
											placeholder="Paste the connection code here..." 
											class="flex-1 rounded-md p-3 bg-[#0f1530] border border-[#2c3978] text-sm" 
										/>
										<button on:click={onScanOffer} class="px-4 py-3 bg-[#2a3570] rounded-md" title="Scan QR Code">📷</button>
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
													<div class="text-xs text-slate-400 mb-2">Share this response code back:</div>
													<div id="answerQR" class="flex justify-center mb-3"></div>
													<div class="flex gap-2">
														<input class="flex-1 rounded-md p-2 bg-[#0a0f20] border border-[#2c3978] text-xs font-mono" readonly value={localAnswer} />
														<button class="px-3 py-2 bg-[#2563eb] rounded-md" on:click={() => navigator.clipboard.writeText(localAnswer)}>📋 Copy</button>
													</div>
												</div>
											</div>
										{/if}
									{/if}
								</div>
							</div>
						{/if}
						
						<!-- Connected Peers List -->
						{#if connectedPeers.length > 0}
							<div class="mt-4 pt-4 border-t border-[#2c3978]">
								<div class="text-sm text-slate-400 mb-2">Connected Peers:</div>
								<div class="space-y-1">
												{#each connectedPeers as [_, peer]}
													<div class="flex items-center text-sm">
														<span class="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
														<span class="font-mono text-xs">{peer.remoteId}</span>
														<span class="ml-2 text-slate-500">🟢 Active</span>
													</div>
												{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

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
