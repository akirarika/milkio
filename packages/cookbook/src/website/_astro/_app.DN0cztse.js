const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["_astro/foo.DJFV9mOJ.js","_astro/vue.EXI6sy5b.js","_astro/runtime-dom.esm-bundler.B6d9hJ3Z.js","_astro/index.oZS3Irfv.css","_astro/bar.DEjdxYZe.js","_astro/baz.CgUX6IMB.js"])))=>i.map(i=>d[i]);
import{_ as f,A as g,a as $,b as A}from"./vue.EXI6sy5b.js";/* empty css                     */import{d as h,o as b,c as w,e as y,w as l,f as _,g as u,i as P}from"./runtime-dom.esm-bundler.B6d9hJ3Z.js";/* empty css                       */const S="modulepreload",k=function(i){return"/"+i},m={},d=function(r,t,p){let a=Promise.resolve();if(t&&t.length>0){document.getElementsByTagName("link");const s=document.querySelector("meta[property=csp-nonce]"),o=s?.nonce||s?.getAttribute("nonce");a=Promise.all(t.map(e=>{if(e=k(e),e in m)return;m[e]=!0;const c=e.endsWith(".css"),v=c?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${e}"]${v}`))return;const n=document.createElement("link");if(n.rel=c?"stylesheet":S,c||(n.as="script",n.crossOrigin=""),n.href=e,o&&n.setAttribute("nonce",o),document.head.appendChild(n),c)return new Promise((E,x)=>{n.addEventListener("load",E),n.addEventListener("error",()=>x(new Error(`Unable to preload CSS for ${e}`)))})}))}return a.then(()=>r()).catch(s=>{const o=new Event("vite:preloadError",{cancelable:!0});if(o.payload=s,window.dispatchEvent(o),!o.defaultPrevented)throw s})},V=h({__name:"index",setup(i,{expose:r}){r();const t={};return Object.defineProperty(t,"__isScriptSetup",{enumerable:!1,value:!0}),t}}),C={class:"aurora-index-component"};function N(i,r,t,p,a,s){return b(),w("div",C," hello world ")}const T=f(V,[["render",N],["__scopeId","data-v-070e9156"]]),I=h({__name:"$app",setup(i,{expose:r}){r();const a={app:{index:()=>T,indexName:"首页",indexIcon:'<i class="ri-home-4-fill"></i>',routes:[{path:"/foo",name:"foo",icon:'<i class="ri-home-4-fill"></i>',component:()=>d(()=>import("./foo.DJFV9mOJ.js"),__vite__mapDeps([0,1,2,3]))},{path:"/bar",name:"bar",icon:'<i class="ri-home-4-fill"></i>',component:()=>d(()=>import("./bar.DEjdxYZe.js"),__vite__mapDeps([4,1,2,3]))},{path:"/baz",name:"baz",icon:'<i class="ri-home-4-fill"></i>',component:()=>d(()=>import("./baz.CgUX6IMB.js"),__vite__mapDeps([5,1,2,3]))}]},navigates:[{name:"首页",icon:'<i class="ri-home-4-fill"></i>',path:"/"}]};return Object.defineProperty(a,"__isScriptSetup",{enumerable:!1,value:!0}),a}}),L=P("i",{class:"ri-home-4-fill"},null,-1);function O(i,r,t,p,a,s){const o=$,e=A,c=g;return b(),y(c,{options:p.app},{"desktop-menubar":l(()=>[_(o,{padding:"8rem"},{default:l(()=>[_(o,{color:"grey",margin:"0 0 16px 0",padding:"0 8px"},{default:l(()=>[u(" 颜色 ")]),_:1}),_(e,{navigates:p.navigates},{before:l(()=>[L]),name:l(()=>[u(" 首页 ")]),_:1})]),_:1})]),default:l(()=>[u(" default ")]),_:1})}const j=f(I,[["render",O]]);export{j as default};