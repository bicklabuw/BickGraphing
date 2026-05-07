(function(){"use strict";function y(g){const f=g.length;if((f&f-1)!==0)throw new Error("Input length must be a power of 2");const n=g.slice(),a=new Float32Array(f);let o=0;for(let t=0;t<f;t++){t<o&&([n[t],n[o]]=[n[o],n[t]],[a[t],a[o]]=[a[o],a[t]]);let e=f>>1;for(;o>=e&&e>=2;)o-=e,e>>=1;o+=e}for(let t=2;t<=f;t<<=1){const e=t>>1,m=Math.PI*2/t;for(let i=0;i<f;i+=t)for(let l=0;l<e;l++){const h=m*l,w=Math.cos(h),s=-Math.sin(h),r=i+l,M=w*n[r+e]-s*a[r+e],u=s*n[r+e]+w*a[r+e];n[r+e]=n[r]-M,a[r+e]=a[r]-u,n[r]+=M,a[r]+=u}}const p=new Float32Array(f/2);for(let t=0;t<f/2;t++)p[t]=Math.sqrt(n[t]*n[t]+a[t]*a[t]);return p}/**
 * @module
 * Description: STFT worker — computes log-magnitudes for an assigned range of
 * frames and returns them as a single flat Float32Array. Each frame's FFT is
 * independent, so spectrogram.svelte can run several of these in parallel
 * across `navigator.hardwareConcurrency` cores.
 *
 * @author K. Seow <kseow@wisc.edu>
 * @contributors
 * @created 2026-05-05
 * @version 0.2.0
 * @license MIT
 *
 * Wire protocol (discriminated by `type`):
 *   in : { workerId, pcm, fftSize, hopSize, frameStart, frameCount }
 *   out: { type: 'PROGRESS', workerId, framesComplete, frameCount }
 *        ...periodic, sent every REPORT_EVERY frames during the loop
 *   out: { type: 'DONE', workerId, frameStart, frameCount, magnitudes, elapsedMs }
 *        ...sent once at the end, with `magnitudes.buffer` in the transfer list
 *
 * `pcm` is a Float32Array containing only the samples this worker needs
 * (from sample `frameStart * hopSize` through the end of the last frame).
 * The buffer is transferred — the main thread loses access after posting.
 */const S=500;self.onmessage=g=>{const f=performance.now(),{workerId:n,pcm:a,fftSize:o,hopSize:p,frameStart:t,frameCount:e}=g.data,m=o>>1,i=new Float32Array(o);for(let s=0;s<o;s++)i[s]=.5*(1-Math.cos(2*Math.PI*s/(o-1)));const l=new Float32Array(e*m),h=new Float32Array(o);for(let s=0;s<e;s++){const r=s*p;for(let c=0;c<o;c++)h[c]=a[r+c]*i[c];const M=y(Array.from(h)),u=s*m;for(let c=0;c<m;c++)l[u+c]=Math.log10(M[c]+1e-6);if(s>0&&s%S===0){const c={type:"PROGRESS",workerId:n,framesComplete:s,frameCount:e};self.postMessage(c)}}const w={type:"DONE",workerId:n,frameStart:t,frameCount:e,magnitudes:l,elapsedMs:performance.now()-f};self.postMessage(w,[l.buffer])}})();
