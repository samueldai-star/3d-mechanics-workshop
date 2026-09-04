// 極簡的 x-dc 樣板 → React 編譯器（不是 Claude Design 的 support.js，是 repo 端自己寫的相容子集，
// 只用來讓 mechanics-workshop.dc.html 能在沒有 Claude Design 執行環境下，真的用 React 跑起來測試）。
//
// 只支援這個檔案實際用到的語法：
//   {{ dotted.path }}                 文字／屬性插值，僅限單一識別字或點記法，不支援任意運算式
//   ref="{{ name }}"                  → React ref
//   onClick="{{ name }}"              → React onClick
//   <sc-if value="{{ cond }}">...</sc-if>                查得到才渲染子節點，忽略 hint-placeholder-*
//   <sc-for list="{{ arr }}" as="x">...單一子節點...</sc-for>  arr.map，子節點內可用 {{ x.prop }}
//   style-hover="css 宣告"            滑鼠移入/移出合併／還原這段行內樣式

const BARE_EXPR = /^\{\{\s*([\w.]+)\s*\}\}$/;
const EXPR_G = /\{\{\s*([\w.]+)\s*\}\}/g;

function resolve(path, vals, scope) {
  const parts = path.split('.');
  const root = parts[0];
  let obj = Object.prototype.hasOwnProperty.call(scope, root) ? scope[root] : vals[root];
  for (let i = 1; i < parts.length && obj != null; i++) obj = obj[parts[i]];
  return obj;
}

function interpText(text, vals, scope) {
  if (!text.includes('{{')) return text;
  return text.replace(EXPR_G, (_, p) => {
    const v = resolve(p, vals, scope);
    return v == null ? '' : String(v);
  });
}

function parseCssDecls(css) {
  const out = {};
  css.split(';').forEach(decl => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const prop = decl.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const val = decl.slice(i + 1).trim();
    if (prop) out[prop] = val;
  });
  return out;
}

function compileNode(node, React) {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    const raw = node.textContent;
    if (!raw || !raw.trim()) return null;
    return (vals, scope) => interpText(raw, vals, scope);
  }
  if (node.nodeType !== 1 /* ELEMENT_NODE */) return null;

  const tag = node.tagName.toLowerCase();

  if (tag === 'sc-if') {
    const condPath = (node.getAttribute('value') || '').match(BARE_EXPR);
    const path = condPath ? condPath[1] : null;
    const childFns = Array.from(node.childNodes).map(c => compileNode(c, React)).filter(Boolean);
    return (vals, scope) => {
      const cond = path ? resolve(path, vals, scope) : false;
      if (!cond) return null;
      return React.createElement(React.Fragment, null, ...childFns.map(f => f(vals, scope)));
    };
  }

  if (tag === 'sc-for') {
    const listPath = (node.getAttribute('list') || '').match(BARE_EXPR);
    const path = listPath ? listPath[1] : null;
    const asName = node.getAttribute('as') || 'item';
    const templateChild = Array.from(node.children)[0];
    const childFn = templateChild ? compileNode(templateChild, React) : null;
    return (vals, scope) => {
      const arr = path ? resolve(path, vals, scope) : null;
      if (!Array.isArray(arr) || !childFn) return null;
      return React.createElement(React.Fragment, null, ...arr.map((item, i) =>
        React.createElement(React.Fragment, { key: i }, childFn(vals, { ...scope, [asName]: item }))
      ));
    };
  }

  const childFns = Array.from(node.childNodes).map(c => compileNode(c, React)).filter(Boolean);
  const staticAttrs = {};
  let refPath = null, onClickPath = null, styleObj = null, hoverObj = null;

  Array.from(node.attributes).forEach(attr => {
    const name = attr.name, value = attr.value;
    if (name === 'ref') { const m = value.match(BARE_EXPR); if (m) refPath = m[1]; return; }
    if (name === 'onclick') { const m = value.match(BARE_EXPR); if (m) onClickPath = m[1]; return; }
    if (name === 'style') { styleObj = parseCssDecls(value); return; }
    if (name === 'style-hover') { hoverObj = parseCssDecls(value); return; }
    if (name.startsWith('hint-placeholder')) return;
    const key = name === 'class' ? 'className' : name;
    staticAttrs[key] = value.includes('{{') ? null /* resolved per-render below */ : value;
  });
  const dynamicAttrNames = Object.keys(staticAttrs).filter(k => staticAttrs[k] === null);
  const dynamicAttrRaw = {};
  dynamicAttrNames.forEach(k => { dynamicAttrRaw[k] = Array.from(node.attributes).find(a => (a.name === k || (k === 'className' && a.name === 'class'))).value; });

  return (vals, scope) => {
    const props = { ...staticAttrs };
    dynamicAttrNames.forEach(k => { props[k] = interpText(dynamicAttrRaw[k], vals, scope); });
    if (styleObj) props.style = styleObj;
    if (refPath) props.ref = resolve(refPath, vals, scope);
    if (onClickPath) {
      const fn = resolve(onClickPath, vals, scope);
      if (typeof fn === 'function') props.onClick = fn;
    }
    if (hoverObj) {
      const base = styleObj || {};
      props.onMouseEnter = e => Object.assign(e.currentTarget.style, hoverObj);
      props.onMouseLeave = e => { e.currentTarget.removeAttribute('style'); Object.assign(e.currentTarget.style, base); };
    }
    const children = childFns.map(f => f(vals, scope));
    return React.createElement(tag, props, ...children);
  };
}

// rootNode：<x-dc> 底下扣掉 <helmet> 之後的那個真正樣板根節點（一個 <div ref="{{ rootRef }}">）。
export function compileTemplate(rootNode, React) {
  const compiled = compileNode(rootNode, React);
  return (vals) => compiled(vals, {});
}

// 從 mechanics-workshop.dc.html 的原始文字裡，切出 <helmet> 的 <style> 內容，與樣板根節點、JS 邏輯區塊。
export function extractParts(html) {
  const xdcMatch = html.match(/<x-dc>([\s\S]*?)<\/x-dc>/);
  const scriptMatch = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!xdcMatch) throw new Error('找不到 <x-dc>...</x-dc> 區塊');
  if (!scriptMatch) throw new Error('找不到 <script type="text/x-dc"> 區塊');

  const doc = new DOMParser().parseFromString('<div id="_x">' + xdcMatch[1] + '</div>', 'text/html');
  const xdcRoot = doc.getElementById('_x');
  const helmet = xdcRoot.querySelector('helmet');
  const styleText = helmet ? Array.from(helmet.querySelectorAll('style')).map(s => s.textContent).join('\n') : '';
  const templateRoot = Array.from(xdcRoot.children).find(c => c.tagName.toLowerCase() !== 'helmet');
  if (!templateRoot) throw new Error('<x-dc> 裡找不到樣板根節點（helmet 以外的元素）');

  return { templateRoot, styleText, scriptCode: scriptMatch[1] };
}
