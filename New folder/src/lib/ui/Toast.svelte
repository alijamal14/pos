<script context="module" lang="ts">
  import { writable, type Writable } from 'svelte/store';
  export const toasts: Writable<Array<{id:string, text:string, type?:string}>> = typeof window !== 'undefined'
    ? writable([])
    : { subscribe: () => { return () => {}; } } as any;
  export function pushToast(text:string, type='info'){
    if (typeof window === 'undefined') return;
    const id = Math.random().toString(36).slice(2,9);
    toasts.update(t=>[...t,{id,text,type}]);
    setTimeout(()=>toasts.update(t=>t.filter(x=>x.id!==id)), 3000);
  }
</script>
<script lang="ts">
  import { fly } from 'svelte/transition';
</script>

<style>
.toast { padding:8px 12px; border-radius:8px; margin:6px; }
.toast-info { background:#1e293b; color:#e2e8f0 }
.toast-success { background:#064e3b; color:#a7f3d0 }
.toast-error { background:#58151c; color:#fecaca }
</style>

{#if typeof window !== 'undefined'}
<div style="position:fixed;right:16px;top:16px;z-index:9999;">
  {#each $toasts as t (t.id)}
    <div class="toast toast-{t.type}" in:fly={{ x: 100 }} out:fly={{ x: 100 }}>
      {t.text}
    </div>
  {/each}
</div>
{/if}
