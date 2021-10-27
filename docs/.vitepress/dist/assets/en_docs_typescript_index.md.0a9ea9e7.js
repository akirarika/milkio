import{_ as n,c as s,o as a,a as e}from"./app.18ab0afe.js";const m='{"title":"TypeScript","description":"","frontmatter":{},"headers":[{"level":2,"title":"Key-value Model","slug":"key-value-model"},{"level":2,"title":"Collection Model","slug":"collection-model"},{"level":2,"title":"Store Additional Data","slug":"store-additional-data"}],"relativePath":"en/docs/typescript/index.md","lastUpdated":1635253574182}',p={},t=e(`<h1 id="typescript" tabindex="-1">TypeScript <a class="header-anchor" href="#typescript" aria-hidden="true">#</a></h1><p>Kurimudb supports TypeScript. In addition to bringing you code hints, you can also rely on generics to limit the format and type of data stored.</p><h2 id="key-value-model" tabindex="-1">Key-value Model <a class="header-anchor" href="#key-value-model" aria-hidden="true">#</a></h2><div class="language-ts line-numbers-mode"><pre><code><span class="token keyword">import</span> <span class="token punctuation">{</span> SyncModels <span class="token punctuation">}</span> <span class="token keyword">from</span> <span class="token string">&#39;kurimudb&#39;</span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token punctuation">{</span>
  localStorageDriverFactory<span class="token punctuation">,</span>
  LocalStorageDriver<span class="token punctuation">,</span>
<span class="token punctuation">}</span> <span class="token keyword">from</span> <span class="token string">&#39;kurimudb-driver-localstorage&#39;</span><span class="token punctuation">;</span>

<span class="token keyword">interface</span> <span class="token class-name">ThemeInterface</span> <span class="token punctuation">{</span>
  color<span class="token operator">:</span> <span class="token builtin">string</span><span class="token punctuation">;</span>
  fontSize<span class="token operator">:</span> <span class="token builtin">number</span><span class="token punctuation">;</span>
  background<span class="token operator">:</span> <span class="token builtin">string</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>

<span class="token keyword">export</span> <span class="token keyword">default</span> <span class="token keyword">new</span> <span class="token punctuation">(</span><span class="token keyword">class</span> <span class="token class-name">ThemeState</span> <span class="token keyword">extends</span> <span class="token class-name">SyncModels</span><span class="token punctuation">.</span>keyValue<span class="token operator">&lt;</span>
  ThemeInterface<span class="token punctuation">,</span> <span class="token comment">// restrict the data format of the model, namely the form of \`themeState.data\`</span>
  LocalStorageDriver <span class="token comment">// if you pass in the driver, you can get the code hint of the driver&#39;s proprietary Api</span>
<span class="token operator">&gt;</span> <span class="token punctuation">{</span>
  <span class="token function">constructor</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword">super</span><span class="token punctuation">(</span><span class="token punctuation">{</span>
      driver<span class="token operator">:</span> localStorageDriverFactory<span class="token punctuation">,</span>
    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
  <span class="token punctuation">}</span>
<span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers-wrapper"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br><span class="line-number">19</span><br><span class="line-number">20</span><br><span class="line-number">21</span><br><span class="line-number">22</span><br></div></div><h2 id="collection-model" tabindex="-1">Collection Model <a class="header-anchor" href="#collection-model" aria-hidden="true">#</a></h2><div class="language-ts line-numbers-mode"><pre><code><span class="token keyword">import</span> <span class="token punctuation">{</span> SyncModels <span class="token punctuation">}</span> <span class="token keyword">from</span> <span class="token string">&#39;kurimudb&#39;</span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token punctuation">{</span>
  localStorageDriverFactory<span class="token punctuation">,</span>
  LocalStorageDriver<span class="token punctuation">,</span>
<span class="token punctuation">}</span> <span class="token keyword">from</span> <span class="token string">&#39;kurimudb-driver-localstorage&#39;</span><span class="token punctuation">;</span>

<span class="token keyword">interface</span> <span class="token class-name">NoteItemInterface</span> <span class="token punctuation">{</span>
  title<span class="token operator">:</span> <span class="token builtin">string</span><span class="token punctuation">;</span>
  content<span class="token operator">:</span> <span class="token builtin">string</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>

<span class="token keyword">export</span> <span class="token keyword">default</span> <span class="token keyword">new</span> <span class="token punctuation">(</span><span class="token keyword">class</span> <span class="token class-name">NoteList</span> <span class="token keyword">extends</span> <span class="token class-name">SyncModels</span><span class="token punctuation">.</span>collection<span class="token operator">&lt;</span>
  NoteItemInterface<span class="token punctuation">,</span> <span class="token comment">// restrict the format of each sub-item in the collection model</span>
  LocalStorageDriver <span class="token comment">// if you pass in the driver, you can get the code hint of the driver&#39;s proprietary Api</span>
<span class="token operator">&gt;</span> <span class="token punctuation">{</span>
  <span class="token function">constructor</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword">super</span><span class="token punctuation">(</span><span class="token punctuation">{</span>
      driver<span class="token operator">:</span> localStorageDriverFactory<span class="token punctuation">,</span>
    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
  <span class="token punctuation">}</span>
<span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers-wrapper"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br><span class="line-number">19</span><br><span class="line-number">20</span><br><span class="line-number">21</span><br></div></div><h2 id="store-additional-data" tabindex="-1">Store Additional Data <a class="header-anchor" href="#store-additional-data" aria-hidden="true">#</a></h2><p>If you want a key-value pair model that can store data other than non-conventional keys, you can write like this:</p><div class="language-ts line-numbers-mode"><div class="highlight-lines"><br><br><br><br><br><br><br><br><br><br><div class="highlighted">\xA0</div><br><br><br><br><br><br><br><br><br><br><br><br><br></div><pre><code><span class="token keyword">import</span> <span class="token punctuation">{</span> SyncModels <span class="token punctuation">}</span> <span class="token keyword">from</span> <span class="token string">&#39;kurimudb&#39;</span><span class="token punctuation">;</span>
<span class="token keyword">import</span> <span class="token punctuation">{</span>
  localStorageDriverFactory<span class="token punctuation">,</span>
  LocalStorageDriver<span class="token punctuation">,</span>
<span class="token punctuation">}</span> <span class="token keyword">from</span> <span class="token string">&#39;kurimudb-driver-localstorage&#39;</span><span class="token punctuation">;</span>

<span class="token keyword">interface</span> <span class="token class-name">ThemeInterface</span> <span class="token punctuation">{</span>
  color<span class="token operator">:</span> <span class="token builtin">string</span><span class="token punctuation">;</span>
  fontSize<span class="token operator">:</span> <span class="token builtin">number</span><span class="token punctuation">;</span>
  background<span class="token operator">:</span> <span class="token builtin">string</span><span class="token punctuation">;</span>
  <span class="token punctuation">[</span>other<span class="token operator">:</span> <span class="token builtin">string</span><span class="token punctuation">]</span><span class="token operator">:</span> <span class="token builtin">any</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>

<span class="token keyword">export</span> <span class="token keyword">default</span> <span class="token keyword">new</span> <span class="token punctuation">(</span><span class="token keyword">class</span> <span class="token class-name">ThemeState</span> <span class="token keyword">extends</span> <span class="token class-name">SyncModels</span><span class="token punctuation">.</span>keyValue<span class="token operator">&lt;</span>
  ThemeInterface<span class="token punctuation">,</span> <span class="token comment">// restrict the format of each sub-item in the collection model</span>
  LocalStorageDriver <span class="token comment">// if you pass in the driver, you can get the code hint of the driver&#39;s proprietary Api</span>
<span class="token operator">&gt;</span> <span class="token punctuation">{</span>
  <span class="token function">constructor</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword">super</span><span class="token punctuation">(</span><span class="token punctuation">{</span>
      driver<span class="token operator">:</span> localStorageDriverFactory<span class="token punctuation">,</span>
    <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
  <span class="token punctuation">}</span>
<span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
</code></pre><div class="line-numbers-wrapper"><span class="line-number">1</span><br><span class="line-number">2</span><br><span class="line-number">3</span><br><span class="line-number">4</span><br><span class="line-number">5</span><br><span class="line-number">6</span><br><span class="line-number">7</span><br><span class="line-number">8</span><br><span class="line-number">9</span><br><span class="line-number">10</span><br><span class="line-number">11</span><br><span class="line-number">12</span><br><span class="line-number">13</span><br><span class="line-number">14</span><br><span class="line-number">15</span><br><span class="line-number">16</span><br><span class="line-number">17</span><br><span class="line-number">18</span><br><span class="line-number">19</span><br><span class="line-number">20</span><br><span class="line-number">21</span><br><span class="line-number">22</span><br><span class="line-number">23</span><br></div></div>`,9),o=[t];function c(l,r,i,u,k,b){return a(),s("div",null,o)}var y=n(p,[["render",c]]);export{m as __pageData,y as default};
