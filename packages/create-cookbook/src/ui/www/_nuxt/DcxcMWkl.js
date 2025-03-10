import{u as S,d as B,r as N,a as P,o as E,b as I,c as U,e as T,f as H,h as L,g as R,p as V,i as q,j as m,k as z,l as F,m as M,n as D,w as $,q as W,s as G,t as K,v as Q,x as J,y as k,z as C,A as X,B as Y,C as Z}from"./CIqA1Z9E.js";import{_ as ee}from"./DlAUqK2U.js";async function j(t,n=S()){const{path:l,matched:c}=n.resolve(t);if(!c.length||(n._routePreloaded||(n._routePreloaded=new Set),n._routePreloaded.has(l)))return;const f=n._preloadPromises=n._preloadPromises||[];if(f.length>4)return Promise.all(f).then(()=>j(t,n));n._routePreloaded.add(l);const e=c.map(r=>r.components?.default).filter(r=>typeof r=="function");for(const r of e){const h=Promise.resolve(r()).catch(()=>{}).finally(()=>f.splice(f.indexOf(h)));f.push(h)}await Promise.all(f)}const te=(...t)=>t.find(n=>n!==void 0);function ne(t){const n=t.componentName||"NuxtLink";function l(e){return typeof e=="string"&&e.startsWith("#")}function c(e,r){if(!e||t.trailingSlash!=="append"&&t.trailingSlash!=="remove")return e;if(typeof e=="string")return A(e,t.trailingSlash);const h="path"in e&&e.path!==void 0?e.path:r(e).path;return{...e,name:void 0,path:A(h,t.trailingSlash)}}function f(e){const r=S(),h=M(),i=m(()=>!!e.target&&e.target!=="_self"),d=m(()=>{const s=e.to||e.href||"";return typeof s=="string"&&z(s,{acceptRelative:!0})}),x=R("RouterLink"),b=typeof x!="string"?x.useLink:void 0,v=m(()=>{if(e.external)return!0;const s=e.to||e.href||"";return typeof s=="object"?!1:s===""||d.value}),o=m(()=>{const s=e.to||e.href||"";return v.value?s:c(s,r.resolve)}),g=v.value?void 0:b?.({...e,to:o}),y=m(()=>{if(!o.value||d.value||l(o.value))return o.value;if(v.value){const s=typeof o.value=="object"&&"path"in o.value?q(o.value):o.value,w=typeof s=="object"?r.resolve(s).href:s;return c(w,r.resolve)}return typeof o.value=="object"?r.resolve(o.value)?.href??null:c(F(h.app.baseURL,o.value),r.resolve)});return{to:o,hasTarget:i,isAbsoluteUrl:d,isExternal:v,href:y,isActive:g?.isActive??m(()=>o.value===r.currentRoute.value.path),isExactActive:g?.isExactActive??m(()=>o.value===r.currentRoute.value.path),route:g?.route??m(()=>r.resolve(o.value)),async navigate(){await D(y.value,{replace:e.replace,external:v.value||i.value})}}}return B({name:n,props:{to:{type:[String,Object],default:void 0,required:!1},href:{type:[String,Object],default:void 0,required:!1},target:{type:String,default:void 0,required:!1},rel:{type:String,default:void 0,required:!1},noRel:{type:Boolean,default:void 0,required:!1},prefetch:{type:Boolean,default:void 0,required:!1},prefetchOn:{type:[String,Object],default:void 0,required:!1},noPrefetch:{type:Boolean,default:void 0,required:!1},activeClass:{type:String,default:void 0,required:!1},exactActiveClass:{type:String,default:void 0,required:!1},prefetchedClass:{type:String,default:void 0,required:!1},replace:{type:Boolean,default:void 0,required:!1},ariaCurrentValue:{type:String,default:void 0,required:!1},external:{type:Boolean,default:void 0,required:!1},custom:{type:Boolean,default:void 0,required:!1}},useLink:f,setup(e,{slots:r}){const h=S(),{to:i,href:d,navigate:x,isExternal:b,hasTarget:v,isAbsoluteUrl:o}=f(e),g=N(!1),y=N(null),s=u=>{y.value=e.custom?u?.$el?.nextElementSibling:u?.$el};function w(u){return!g.value&&(typeof e.prefetchOn=="string"?e.prefetchOn===u:e.prefetchOn?.[u]??t.prefetchOn?.[u])&&(e.prefetch??t.prefetch)!==!1&&e.noPrefetch!==!0&&e.target!=="_blank"&&!ie()}async function _(u=P()){if(g.value)return;g.value=!0;const p=typeof i.value=="string"?i.value:b.value?q(i.value):h.resolve(i.value).fullPath,a=b.value?new URL(p,window.location.href).href:p;await Promise.all([u.hooks.callHook("link:prefetch",a).catch(()=>{}),!b.value&&!v.value&&j(i.value,h).catch(()=>{})])}if(w("visibility")){const u=P();let p,a=null;E(()=>{const O=ae();I(()=>{p=U(()=>{y?.value?.tagName&&(a=O.observe(y.value,async()=>{a?.(),a=null,await _(u)}))})})}),T(()=>{p&&H(p),a?.(),a=null})}return()=>{if(!b.value&&!v.value&&!l(i.value)){const a={ref:s,to:i.value,activeClass:e.activeClass||t.activeClass,exactActiveClass:e.exactActiveClass||t.exactActiveClass,replace:e.replace,ariaCurrentValue:e.ariaCurrentValue,custom:e.custom};return e.custom||(w("interaction")&&(a.onPointerenter=_.bind(null,void 0),a.onFocus=_.bind(null,void 0)),g.value&&(a.class=e.prefetchedClass||t.prefetchedClass),a.rel=e.rel||void 0),L(R("RouterLink"),a,r.default)}const u=e.target||null,p=te(e.noRel?"":e.rel,t.externalRelAttribute,o.value||v.value?"noopener noreferrer":"")||null;return e.custom?r.default?r.default({href:d.value,navigate:x,prefetch:_,get route(){if(!d.value)return;const a=new URL(d.value,window.location.href);return{path:a.pathname,fullPath:a.pathname,get query(){return V(a.search)},hash:a.hash,params:{},name:void 0,matched:[],redirectedFrom:void 0,meta:{},href:d.value}},rel:p,target:u,isExternal:b.value||v.value,isActive:!1,isExactActive:!1}):null:L("a",{ref:y,href:d.value||null,rel:p,target:u},r.default?.())}}})}const re=ne(G);function A(t,n){const l=n==="append"?$:W;return z(t)&&!t.startsWith("http")?t:l(t,!0)}function ae(){const t=P();if(t._observer)return t._observer;let n=null;const l=new Map,c=(e,r)=>(n||(n=new IntersectionObserver(h=>{for(const i of h){const d=l.get(i.target);(i.isIntersecting||i.intersectionRatio>0)&&d&&d()}})),l.set(e,r),n.observe(e),()=>{l.delete(e),n?.unobserve(e),l.size===0&&(n?.disconnect(),n=null)});return t._observer={observe:c}}const oe=/2g/;function ie(){const t=navigator.connection;return!!(t&&(t.saveData||oe.test(t.effectiveType)))}const se={class:"antialiased bg-white dark:bg-black dark:text-white font-sans grid min-h-screen overflow-hidden place-content-center text-black"},le={class:"max-w-520px text-center z-20"},ue=["textContent"],ce=["textContent"],fe={class:"flex items-center justify-center w-full"},de={__name:"error-404",props:{appName:{type:String,default:"Nuxt"},version:{type:String,default:""},statusCode:{type:Number,default:404},statusMessage:{type:String,default:"Not Found"},description:{type:String,default:"Sorry, the page you are looking for could not be found."},backHome:{type:String,default:"Go back home"}},setup(t){const n=t;return K({title:`${n.statusCode} - ${n.statusMessage} | ${n.appName}`,script:[{children:`!function(){const e=document.createElement("link").relList;if(!(e&&e.supports&&e.supports("modulepreload"))){for(const e of document.querySelectorAll('link[rel="modulepreload"]'))r(e);new MutationObserver((e=>{for(const o of e)if("childList"===o.type)for(const e of o.addedNodes)"LINK"===e.tagName&&"modulepreload"===e.rel&&r(e)})).observe(document,{childList:!0,subtree:!0})}function r(e){if(e.ep)return;e.ep=!0;const r=function(e){const r={};return e.integrity&&(r.integrity=e.integrity),e.referrerPolicy&&(r.referrerPolicy=e.referrerPolicy),"use-credentials"===e.crossOrigin?r.credentials="include":"anonymous"===e.crossOrigin?r.credentials="omit":r.credentials="same-origin",r}(e);fetch(e.href,r)}}();`}],style:[{children:'*,:after,:before{border-color:var(--un-default-border-color,#e5e7eb);border-style:solid;border-width:0;box-sizing:border-box}:after,:before{--un-content:""}html{line-height:1.5;-webkit-text-size-adjust:100%;font-family:ui-sans-serif,system-ui,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;font-feature-settings:normal;font-variation-settings:normal;-moz-tab-size:4;tab-size:4;-webkit-tap-highlight-color:transparent}body{line-height:inherit;margin:0}h1{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}h1,p{margin:0}*,:after,:before{--un-rotate:0;--un-rotate-x:0;--un-rotate-y:0;--un-rotate-z:0;--un-scale-x:1;--un-scale-y:1;--un-scale-z:1;--un-skew-x:0;--un-skew-y:0;--un-translate-x:0;--un-translate-y:0;--un-translate-z:0;--un-pan-x: ;--un-pan-y: ;--un-pinch-zoom: ;--un-scroll-snap-strictness:proximity;--un-ordinal: ;--un-slashed-zero: ;--un-numeric-figure: ;--un-numeric-spacing: ;--un-numeric-fraction: ;--un-border-spacing-x:0;--un-border-spacing-y:0;--un-ring-offset-shadow:0 0 transparent;--un-ring-shadow:0 0 transparent;--un-shadow-inset: ;--un-shadow:0 0 transparent;--un-ring-inset: ;--un-ring-offset-width:0px;--un-ring-offset-color:#fff;--un-ring-width:0px;--un-ring-color:rgba(147,197,253,.5);--un-blur: ;--un-brightness: ;--un-contrast: ;--un-drop-shadow: ;--un-grayscale: ;--un-hue-rotate: ;--un-invert: ;--un-saturate: ;--un-sepia: ;--un-backdrop-blur: ;--un-backdrop-brightness: ;--un-backdrop-contrast: ;--un-backdrop-grayscale: ;--un-backdrop-hue-rotate: ;--un-backdrop-invert: ;--un-backdrop-opacity: ;--un-backdrop-saturate: ;--un-backdrop-sepia: }'}]}),(l,c)=>{const f=re;return J(),Q("div",se,[c[0]||(c[0]=k("div",{class:"fixed left-0 right-0 spotlight z-10"},null,-1)),k("div",le,[k("h1",{class:"font-medium mb-8 sm:text-10xl text-8xl",textContent:C(t.statusCode)},null,8,ue),k("p",{class:"font-light leading-tight mb-16 px-8 sm:px-0 sm:text-4xl text-xl",textContent:C(t.description)},null,8,ce),k("div",fe,[X(f,{to:"/",class:"cursor-pointer gradient-border px-4 py-2 sm:px-6 sm:py-3 sm:text-xl text-md"},{default:Y(()=>[Z(C(t.backHome),1)]),_:1})])])])}}},pe=ee(de,[["__scopeId","data-v-cdc81b9e"]]);export{pe as default};
