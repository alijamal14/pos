<script lang="ts">
	import { onMount } from 'svelte';
	import { itemsStore, loadFromDB, makeItem, applyOp, exportJSON, importJSON } from '$lib/state/items';
	import { generateToCanvas } from '$lib/qr/generate';
	import { startScanner } from '$lib/qr/scan';
	import { pushToast } from '$lib/ui/Toast.svelte';
	import { peerCount, peerStatus } from '$lib/stores/peers';
	import { runDiagnostics } from '$lib/utils/diagnostics';
	import { encodePayload, decodePayload } from '$lib/p2p/signaling';
	import { createOfferAndLocalize, createAnswerAndLocalize, applyRemoteAnswer } from '$lib/p2p/webrtc';
  
	let newText = '';
	let remoteOffer = '';
	let localOffer = '';
	let localAnswer = '';

	$: items = $itemsStore;

	onMount(async () => {
		await loadFromDB();
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
			pushToast('Offer generated', 'info');
		} catch (e) { pushToast('Offer creation failed', 'error'); }
	}

	function copyOffer() {
		if (localOffer) {
			navigator.clipboard.writeText(localOffer);
			pushToast('Offer copied to clipboard', 'success');
		}
	}


		async function onCreateAnswer(){
			try {
				// Parse the offer from remoteOffer
				const offerObj = decodePayload(remoteOffer);
				if (!offerObj.sdp) throw new Error('No SDP in offer');
				const answerDesc = await createAnswerAndLocalize(offerObj.sdp);
				const encoded = encodePayload({ sdp: answerDesc });
				localAnswer = encoded;
				const el = document.getElementById('answerQR') as HTMLElement;
				if (el) await generateToCanvas(el, encoded);
				pushToast('Answer generated', 'info');
			} catch (e) { pushToast('Answer creation failed', 'error'); }
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
				<span class="px-3 py-1 rounded-full bg-[#1a2249]">Peer ID: demo</span>
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
								<div><button class="px-2 py-1 bg-[#2a3570] rounded-md">⋯</button></div>
							</div>
						{/if}
					{/each}
				</div>
			</div>

			<div class="bg-[#121937] p-4 rounded-xl">
				<h2 class="uppercase text-sm mb-2 text-slate-300">Peer-to-Peer Linking</h2>
				<div class="mb-3">
					<button on:click={onCreateOffer} class="px-3 py-2 bg-[#2a3570] rounded-md mr-2">📱 Create Offer</button>
					<span class="px-2 py-1 bg-[#1a2249] rounded-md"> <span class="inline-block w-2 h-2 bg-[#ff6b6b] rounded-full mr-2 align-middle"></span> disconnected</span>
				</div>


				<div id="qrSection" class="mb-3">
					<div id="offerQR" class="inline-block mb-2"></div>
					{#if localOffer}
						<div class="flex gap-2 items-center mt-2">
							<input class="flex-1 rounded-md p-2 bg-[#0f1530] border border-[#2c3978] text-xs" readonly value={localOffer} />
							<button class="px-3 py-2 bg-[#2563eb] rounded-md" on:click={copyOffer}>Copy</button>
						</div>
					{/if}
				</div>

				<div class="mt-3">
					<div class="mb-2 text-slate-400">If you received an Offer from a peer:</div>
					<div class="flex gap-2">
						<input bind:value={remoteOffer} placeholder="Paste peer's Offer here or scan QR" class="flex-1 rounded-md p-2 bg-[#0f1530] border border-[#2c3978]" />
						<button on:click={onScanOffer} class="px-3 py-2 bg-[#2a3570] rounded-md">📷 Scan QR</button>
						<button on:click={onCreateAnswer} class="px-3 py-2 bg-[#2a3570] rounded-md">📱 Create Answer</button>
					</div>

					<div id="answerSection" class="mt-3">
						<div id="answerQR" class="inline-block"></div>
					</div>

					<div class="mt-3 flex gap-2">
						<input bind:value={localAnswer} placeholder="Paste peer's Answer here" class="flex-1 rounded-md p-2 bg-[#0f1530] border border-[#2c3978]" />
						<button on:click={onApplyAnswer} class="px-3 py-2 bg-[#1b7a61] rounded-md">✅ Apply Answer</button>
						<button class="px-3 py-2 bg-[#7a1b1b] rounded-md">❌ Disconnect</button>
					</div>
				</div>
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
