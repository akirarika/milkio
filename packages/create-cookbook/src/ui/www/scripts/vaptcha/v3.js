!(function () {
  'use strict'; function e(e) { return e === undefined || e === null } function t(e) { return e !== undefined && e !== null } function n(e) { return e !== null && (void 0 === e ? 'undefined' : p(e)) === 'object' } function a(e) { return (void 0 === e ? 'undefined' : p(e)) === 'object' && e instanceof HTMLElement } function r(e) { const t = e && e.toString().match(/^\s*function (\w+)/); return t ? t[1] : '' } function o(e) { const t = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {}; for (const n in t)e[n] = t[n]; return e } function i(e) { const t = Object.create(null); return function (n) { return t[n] || (t[n] = e(n)) } } function c(e) { return h.call(e).slice(8, -1) } function u(e) { throw new Error(e) } function l() { if (navigator.cookieEnabled) { localStorage.setItem('vaptchatemp1', '1'); const e = localStorage.getItem('vaptchatemp1'); return localStorage.removeItem('vaptchatemp1'), !!e } return !1 } function Promise(e) {
    const t = this; this.state = 'pending', this.value = undefined, this.reason = undefined, this.onResolveAsyncCallbacks = [], this.onRejectAsyncCallbacks = []; const n = function (e) { t.state === 'pending' && (t.state = 'fulfilled', t.value = e, t.onResolveAsyncCallbacks.map((e) => { return e() })) }; const a = function (e) { t.state === 'pending' && (t.state = 'rejected', t.reason = e, t.onRejectAsyncCallbacks.map((t) => { return t(e) })) }; try { e(n, a) }
    catch (r) { a(r) }
  } function s(e, t) {
    if (!(e instanceof t))
      throw new TypeError('Cannot call a class as a function')
  } function f() { const e = navigator.language || navigator.userLanguage; return e === 'zh-CN' ? 'zh-CN' : e === 'zh-TW' ? 'zh-TW' : e.includes('en', -1) ? 'en' : e.includes('ja', -1) ? 'jp' : e.includes('vi', -1) ? 'vi' : 'zh-CN' }window.HTMLElement = window.HTMLElement || Element, Array.prototype.map || (Array.prototype.map = function (e, t) {
    let n, a, r; if (this == null)
      throw new TypeError(' this is null or not defined'); const o = new Object(this); const i = o.length >>> 0; if (Object.prototype.toString.call(e) != '[object Function]')
      throw new TypeError(`${e} is not a function`); for (t && (n = t), a = new Array(i), r = 0; r < i;) { var c, u; r in o && (c = o[r], u = e.call(n, c, r, o), a[r] = u), r++ } return a
  }), Array.prototype.includes || (Array.prototype.includes = function (e, t) {
    if (this == null)
      throw new TypeError('"this" is null or not defined'); const n = new Object(this); const a = n.length >>> 0; if (a === 0)
      return !1; for (let r = 0 | t, o = Math.max(r >= 0 ? r : a - Math.abs(r), 0); o < a;) {
      if (n[o] === e)
        return !0; o++
    } return !1
  }), Array.prototype.findIndex || (Array.prototype.findIndex = function (e) {
    if (this == null)
      throw new TypeError('"this" is null or not defined'); const t = new Object(this); const n = t.length >>> 0; if (typeof e != 'function')
      throw new TypeError('predicate must be a function'); for (let a = arguments[1], r = 0; r < n;) {
      if (e.call(a, t[r], r, t))
        return r; r++
    } return -1
  }), Object.create || (Object.create = function (e) { const t = function () {}; return t.prototype = e, new t() }); const d = { vid: null, scene: 0, container: null, mode: 'popup', style: 'dark', lang: 'auto', ai: !0, https: !0, guide: !0, aiAnimation: !1, protocol: 'https://', css_version: '2.9.12', cdn_servers: ['statics.vaptcha.com'], api_server: 'api.vaptcha.com/v3', canvas_path: '/canvas.min.js', offline_server: '' }; var p = typeof Symbol == 'function' && typeof Symbol.iterator == 'symbol' ? function (e) { return typeof e } : function (e) { return e && typeof Symbol == 'function' && e.constructor === Symbol && e !== Symbol.prototype ? 'symbol' : typeof e }; var h = Object.prototype.toString; const v = (i((e) => { for (var t = {}, n = e && e.includes('?') && e.split('?')[1] || window.location.search.substring(1), a = n.split('&'), r = 0; r < a.length; r++) { const o = a[r].split('='); t[decodeURIComponent(o[0])] = decodeURIComponent(o[1]) } return t }), i((e) => { return e.charAt(0).toUpperCase() + e.slice(1) })); const g = function (t) { this.data = t, this.valiudateFuns = [], this.ruleFuns = { required(t, n) { return e(t) || t.length === 0 ? n : null } } }; g.prototype = { constructor: g, addValidateRules(e) { o(this.ruleFuns, e) }, add(e, t, n) { const a = this; const r = t.split(':'); const o = r.shift(); const i = this.ruleFuns[o]; r.unshift(this.data[e]), r.push(n), i ? this.valiudateFuns.push(() => { return i.apply(a, r) }) : console.warn(`Validator warning: rule ${o} is not defined`) }, validate() {
    for (var e, t = 0; e = this.valiudateFuns[t++];) {
      const n = e(); if (n)
        return u(n), !1
    } return !0
  } }; const m = { AccessDenied: '0101', RefreshAgain: '0102', Success: '0103', Fail: '0104', RefreshTooFast: '0105', RefreshTanto: '0106', DrawTanto: '0107', Attack: '0108', jsonpTimeOut: '0703', challengeExpire: '1002' }; Promise.prototype.then = function (e) {
    const t = this; if (this.state === 'fulfilled') {
      const a = e(this.value); if (n(a) && r(a.constructor) === 'Promise')
        return a
    } return this.state === 'pending'
      ? new Promise((a) => {
        t.onResolveAsyncCallbacks.push(() => {
          const o = e(t.value); if (n(o) && r(o.constructor) === 'Promise')
            return o.then(a); a(o)
        })
      })
      : this
  }, Promise.prototype.catch = function (e) { return this.state === 'rejected' && e(this.reason), this.state === 'pending' && this.onRejectAsyncCallbacks.push(e), this }, Promise.resolve = function (e) { return new Promise((t) => { t(e) }) }, Promise.reject = function (e) { return new Promise((t, n) => { n(e) }) }; const y = (function () { function e(e, t) { for (let n = 0; n < t.length; n++) { const a = t[n]; a.enumerable = a.enumerable || !1, a.configurable = !0, 'value' in a && (a.writable = !0), Object.defineProperty(e, a.key, a) } } return function (t, n, a) { return n && e(t.prototype, n), a && e(t, a), t } }()); const w = (function () { function e() { s(this, e) } return y(e, [{ key: 'GenerateFP', value() { return this.extractCRC32FromBase64(this.getComplexCanvasFingerprint(arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '')) } }, { key: 'getComplexCanvasFingerprint', value() { const e = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : ''; const t = `BrowserLeaks,com <canvas> 1.0${  e}`; const n = document.createElement('canvas'); n.setAttribute('width', '220'), n.setAttribute('height', '30'); const a = n.getContext('2d'); return a.textBaseline = 'top', a.font = '14px \'Arial\'', a.textBaseline = 'alphabetic', a.fillStyle = '#f60', a.fillRect(125, 1, 62, 20), a.fillStyle = '#069', a.fillText(t, 2, 15), a.fillStyle = 'rgba(102, 204, 0, 0.7)', a.fillText(t, 4, 17), n.toDataURL() } }, { key: 'extractCRC32FromBase64', value(e) { return e = e.replace('data:image/png;base64,', ''), this.string2Hex(atob(e).slice(-16, -12).toString()) } }, { key: 'string2Hex', value(e) { for (var t = '', n = 0; n < e.length; n++) { const a = e.charCodeAt(n); a <= 15 && (t += '0'), t += a.toString(16).toLocaleUpperCase() } return t } }]), e }()); const T = (new w(), (function () {
    let e = d.protocol; let t = d.api_server; const n = function (e) { let t = ''; for (const n in e)Object.prototype.hasOwnProperty.call(e, n) && (t += `&${ n }=${ encodeURIComponent(e[n])}`); return t }; const a = function (a, r) { let o = n(r); const i = a.includes('http://') || a.includes('https://'); return !a.includes('?') && (o = `?${ o.slice(1)}`), i ? `${ a }${o}` : `${ e }${t }${a }${o}` }; const r = function (e) { const t = document.getElementsByTagName('head')[0]; const n = document.createElement('script'); return n.charset = 'UTF-8', n.src = e, t.appendChild(n), { remove() { t.removeChild(n) } } }; const i = function (e, t, n, i) {
      return t = t || {}, n = n || !1, new Promise((c) => {
        if (n) { var u = setTimeout(() => { clearTimeout(u), l.remove(), c({ code: '0703', msg: 'Time out,Refresh Again!' }) }, i || 2e3); window.static = function () { clearTimeout(u), c.apply(this, arguments), l.remove() }; var l = r(e) }
        else { let s = `VaptchaJsonp${(new Date()).valueOf()}`; window[s] && (s += '1'), o(t, { callback: s }), e = a(e, t); const f = r(e); var d = setTimeout(() => { clearTimeout(d), window[s] = null, f.remove(), c({ code: '0703', msg: 'Time out,Refresh Again!' }) }, 1e4); window[s] = function () { clearTimeout(d), c.apply(this, arguments), f.remove(), window[s] = null } }
      })
    }; return i.setConfig = function (n) { e = n.protocol || e, t = n.api_server || t }, i
  }())); const S = { staticConfig(e) { return T(e.protocol + e.url + e.type + e.id, {}, !0, e.waitTime || 2e3) }, getConfig(e) { let n = ''; return l() && t(localStorage.getItem('vaptchanu')) && (n = localStorage.getItem('vaptchanu')), T('/config', { vi: e.vid, t: e.mode, s: e.scene || 0, z: e.zone, v: 3, u: n }) }, lang(e) { return T('http://localhost:8080/api/v1/lang', {}, !1) } }; const C = { 'en': { '0201': 'id empty', '0202': 'id error', '0208': 'scene error', '0209': 'request used up', '0906': 'params error', '0702': 'VAPTCHA unit does not match the domain name', '0105': 'Request too fast, try again later!' }, 'zh-CN': { '0702': '验证单元与域名不匹配', '0105': '刷新过快,请稍后再试。' } }; let b = 0; let j = 9999999999999; let I = 0; let N = 9999999999999; const A = (function () {
    function r() { const e = navigator.language || navigator.userLanguage; return e === 'zh-CN' ? 'zh-CN' : e === 'zh-TW' ? 'zh-TW' : e.includes('en', -1) ? 'en' : e.includes('ja', -1) ? 'jp' : 'zh-CN' } function i(e) {
      if (e.area === 'cn')
        return 'cn'; if (e.area === 'sea')
        return 'sea'; if (e.area === 'na')
        return e.area = 'sea', 'sea'; if (t(localStorage.getItem('vaptchaNetway')) && localStorage.getItem('vaptchaNetway') !== '')
        return o(e, { area: localStorage.getItem('vaptchaNetway') }), localStorage.getItem('vaptchaNetway'); const n = 0 - (new Date()).getTimezoneOffset() / 60; let a = navigator.language || window.navigator.userLanguage; return a = a.toLowerCase(), n === 8 && a === 'zh-cn' ? (o(e, { area: 'cn' }), 'cn') : n === 8 && a !== 'zh-cn' ? (o(e, { area: 'sea' }), 'sea') : n >= 6 && n < 8 || n > 8 && n <= 10 ? (o(e, { area: 'sea' }), 'na') : (o(e, { area: 'na' }), 'na')
    } let l = !1; const s = function (e) {
      let n = void 0; let a = void 0; return t(e.area) ? (n = `channel-${ i(e) }.vaptcha.net/${ i(e)}`, a = `api-${ i(e) }.vaptcha.net`) : (o(e, { area: 'cn' }), n = 'channel-cn.vaptcha.net/cn', a = 'api-cn.vaptcha.net'), b = (new Date()).getTime(), t(localStorage.getItem('vaptchaSpareCh')) && (new Date()).getTime() - localStorage.getItem('vaptchaSpareCh') < 36e5
        ? S.staticConfig({ protocol: e.protocol, id: e.vid, url: n, type: '/config/' }).then((a) => {
            if (j = (new Date()).getTime(), w(i(e), e), t(a.alias))
              return S.staticConfig({ protocol: e.protocol, id: a.alias, url: n, type: '/alias/' }).then((e) => { return o(e, { state: a.state }), Promise.resolve(e) }); console.log('channel error')
          })
        : S.staticConfig({ protocol: e.protocol, url: a, type: '/channel/', id: e.vid, waitTime: 5e3 }).then((a) => {
            return j = (new Date()).getTime(), w(i(e), e), t(a.msg)
              ? (localStorage.setItem('vaptchaSpareCh', (new Date()).getTime()), S.staticConfig({ protocol: e.protocol, id: e.vid, url: n, type: '/config/' }).then((a) => {
                  if (t(a.alias))
                    return S.staticConfig({ protocol: e.protocol, id: a.alias, url: n, type: '/alias/' }).then((e) => { return o(e, { state: a.state }), Promise.resolve(e) }); console.log('channel error')
                }))
              : Promise.resolve(a)
          })
    }; const f = function (e) {
      return s(e).then((n) => {
        if (t(n.code) && n.code === '0703')
          return u('5001: channel interface timeout'), Promise.reject('5001: channel interface timeout'); o(e, { api_server: n.api }), T.setConfig(e); const a = 0 - (new Date()).getTimezoneOffset() / 60; return o(e, { zone: a }), S.getConfig(e)
      }).then((n) => {
        if (t(n.code) && n.code === '0703')
          return u('5002: config interface timeout'), Promise.reject('5002: config interface timeout'); if (!n)
          return Promise.resolve(); if (n.code !== m.Success) { const a = C.en; return n.msg === '0702' ? alert(`${a[n.msg]}`) : n.code === '0105' ? alert(`${a[n.code]}`) : console.log(`errorCode：${n.code}:${n.msg}`), u(a[n.msg] || n.msg), Promise.reject(n.code) } return n.data.guideVersion && n.data.guideVersion > '3.2.0' ? (n.data.v3Update = 0, console.log('Sorry,the version of V3.JS is too low, please upgrade!')) : n.data.v3Update = 1, o(e, n.data), Promise.resolve()
      })
    }; const d = function (e, t) { return `${e.protocol}static-${e.area}.vaptcha.net/${t}` }; const p = function (t) { const n = document.getElementsByTagName('head')[0]; let a = document.getElementById('vaptcha_style'); return new Promise((r) => { e(a) ? (a = document.createElement('link'), o(a, { rel: 'stylesheet', type: 'text/css', href: t, id: 'vaptcha_style', onload: r }), n && n.appendChild(a)) : r() }) }; const h = function O(e) {
      const n = document.getElementsByTagName('head')[0]; let a = document.querySelector(`script[src='${e}']`); return new Promise((r) => {
        if (t(a))
          return void (a.loaded ? r() : setTimeout(() => { return O(e).then(r) })); a = document.createElement('script'); const i = function () { a.readyState && a.readyState !== 'loaded' && a.readyState !== 'complete' || (r(), a.loaded = !0, a.onload = null, a.onreadystatechange = null) }; o(a, { async: !0, charset: 'utf-8', src: e, onerror() { return u('load sdk timeout') }, onload: i, onreadystatechange: i }), n.appendChild(a)
      })
    }; const y = function (e) { const t = e.sdkName; const n = e.config; const a = d(n, `js/${  n.js_path}`); return h(a).then(() => { const e = v(t); return Promise.resolve(new (0, window[`_${e}Vaptcha`])(n)) }) }; var w = function (e, n) { const a = t(localStorage.getItem('vaptchaNetway')); const r = t(localStorage.getItem('vaptchaNetwayTime')) ? localStorage.getItem('vaptchaNetwayTime') : 0; const o = (new Date()).getTime() - r; const i = (t(localStorage.getItem('vaptchaNetwayTime2')) && localStorage.getItem('vaptchaNetwayTime2'), j - b); let c = void 0; if (i < 500 && !a && (localStorage.setItem('vaptchaNetway', e), localStorage.setItem('vaptchaNetwayTime', (new Date()).getTime()), localStorage.setItem('vaptchaNetwayTime2', i)), !a || i >= 500 || o > 864e5) { e = e.toLowerCase(); let u = void 0; u = e == 'cn' ? 'sea' : 'cn'; const l = `api-${ u }.vaptcha.net`; I = (new Date()).getTime(), S.staticConfig({ protocol: n.protocol, url: l, type: '/channel/', id: n.vid, waitTime: 5e3 }).then((t) => { N = (new Date()).getTime(), c = N - I, i < c && (localStorage.setItem('vaptchaNetway', e), localStorage.setItem('vaptchaNetwayTime', (new Date()).getTime()), localStorage.setItem('vaptchaNetwayTime2', i)), c < i && (localStorage.setItem('vaptchaNetway', u), localStorage.setItem('vaptchaNetwayTime', (new Date()).getTime()), localStorage.setItem('vaptchaNetwayTime2', c)) }) } }; const A = function (e) {
      if (e.lang === 'auto' || e.lang === '') { const o = r(); e.lang = o || 'zh-CN' }l = !0, e.https = !0, e.protocol = 'https://', T.setConfig(e), t(e.type) && (e.mode = e.type), e.mode === 'embedded' && (e.mode = 'embed'), !['embed', 'popup', 'invisible'].includes(e.mode) && (e.mode = 'popup'), t(e.mode) && (e.type = e.mode); const i = new g(e); if (i.addValidateRules({ elementOrSelector(t, r) {
        if (c(e.container) === 'String' && (e.container = document.querySelector(e.container)), n(e.container) && a(e.container[0]) && (e.container = e.container[0]), !a(e.container))
          return r
      } }), i.add('vid', 'required', 'please configure vid'), e.mode !== 'invisible' && i.add('container', 'elementOrSelector', '5004: please configure container with element or selector'), i.validate()) {
        return f(e).then(() => { const t = e.https ? `css/theme_https.${  e.css_version  }.css` : `css/theme.${  e.css_version  }.css`; const n = d(e, t); return p(n) }).then(() => { const t = e.mode; return l = !1, y({ sdkName: t, config: e }) })
      }
    }; return function k(e) { return new Promise((t) => { l ? setTimeout(() => { k(e).then(t) }, 1e3) : A(e).then(t) }).catch((e) => { return l = !1, u(e), Promise.reject(e) }) }
  }()); const O = (function () {
    const e = function (e) {
      const n = e.getAttribute('data-config'); let a = {}; if (t(n)) {
        try { a = JSON.parse(n) }
        catch (r) { u('dom config format error') }
      } return a
    }; const n = function (e) { const n = e.getAttribute('data-vid'); return t(n) ? { vid: n } : {} }; const a = function (e, n) { const a = Object.create(d); a.container = e, o(a, n), t(a.vid) && A(a).then((e) => { e.renderTokenInput(), e.render() }) }; return function () {
      for (var t = document.querySelectorAll('[data-vid]'), r = document.querySelectorAll('[data-config]'), o = 0; o < r.length; o++) { const i = e(r[o]); a(r[o], i) } for (let c = 0; c < t.length; c++) {
        if (!Array.prototype.includes.call(r, t[c])) { const u = n(t[c]); a(t[c], u) }
      }
    }
  }()); window.onload = O, window.vaptcha = function (e) { const t = Object.create(d); return o(t, e), (t.lang === 'auto' || t.lang === '') && (t.lang = f() || 'zh-CN'), A(t) }
}())
