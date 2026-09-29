/* ============================================================
   JE TAIMAIS — 站点脚本（纯展示 · 选品笔记）
   数据：assets/data/site.json（站点设置）/ assets/data/shoes.json（笔记）
   首页 = 封面墙；点封面 → 笔记页：封面大图 → 分段图文 → 可任意点开放大
   联系：微信二维码 + 复制微信号
   ============================================================ */
(function () {
  'use strict';

  var state = { site: {}, shoes: [], group: null, index: 0, list: [] };

  /* ---------------- 工具 ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function textToHtml(t) {
    return esc(t).split('\n').filter(function (l) { return l.trim(); })
      .map(function (l) { return '<p>' + l.trim() + '</p>'; }).join('');
  }
  function param(k) { return new URLSearchParams(location.search).get(k); }

  function toast(msg) {
    var el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('is-on'); }, 2600);
  }

  function copyText(text) {
    function ok() { toast('已复制：' + text); }
    function fail() { toast('请手动记录：' + text); }
    function legacy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
        var done = document.execCommand('copy');
        document.body.removeChild(ta);
        done ? ok() : fail();
      } catch (e) { fail(); }
    }
    if (!text) { toast('还没有填写微信号'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, legacy);
    } else { legacy(); }
  }

  /* ---------------- 数据 ---------------- */
  function load() {
    return Promise.all([
      fetch('assets/data/site.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
      fetch('assets/data/shoes.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
    ]).then(function (res) {
      state.site = res[0] || {};
      state.shoes = (Array.isArray(res[1]) ? res[1] : []).filter(function (s) {
        return s && s.images && s.images.length;
      });
      // 全局图片清单（灯箱翻页用）
      state.list = [];
      state.shoes.forEach(function (g) {
        (g.images || []).forEach(function (src) {
          state.list.push({ src: src, group: g });
        });
      });
    });
  }

  /* ---------------- 站点文本 ---------------- */
  function applySite() {
    var s = state.site;
    $$('[data-site]').forEach(function (el) {
      var v = s[el.getAttribute('data-site')];
      if (v != null && v !== '') el.textContent = v;
    });
    $$('[data-site-src]').forEach(function (el) {
      var v = s[el.getAttribute('data-site-src')];
      if (v) el.setAttribute('src', v);
    });

    var about = $('#about-body');
    if (about && s.aboutText) about.innerHTML = textToHtml(s.aboutText);
    var lead = $('#about-lead');
    if (lead && s.aboutLead) lead.textContent = s.aboutLead;

    // 微信号没填时：只留二维码，不显示占位文字和复制按钮
    var PLACEHOLDER = '请填写你的微信号';
    var hasId = !!s.wechatId && s.wechatId !== PLACEHOLDER;
    $$('.contact__qr .id').forEach(function (el) { el.style.display = hasId ? '' : 'none'; });
    $$('[data-copy-wechat]').forEach(function (el) { el.style.display = hasId ? '' : 'none'; });
    if (!hasId) {
      $$('.contact__qr .wx-hint').forEach(function (el) {
        el.textContent = '长按二维码识别，加我微信';
      });
      $$('.contact__qr .id b').forEach(function (el) { el.textContent = ''; });
    }

    var t = document.title;
    if (t.indexOf('__BRAND__') > -1) document.title = t.replace('__BRAND__', s.brandCn || '');
    var d = $('meta[name="description"]');
    if (d && s.taglineSub) d.setAttribute('content', s.taglineSub);
  }

  /* ---------------- 首页：封面墙 ---------------- */
  function renderWall() {
    var wall = $('#wall');
    if (!wall) return;

    if (!state.shoes.length) {
      wall.innerHTML = '<div class="empty" style="grid-column:1/-1">还没有内容。' +
        '在后台新增一条、上传图片后，这里就会自动出现。</div>';
      return;
    }

    wall.innerHTML = state.shoes.map(function (g, i) {
      var cover = g.images[0];
      var count = g.images.length;
      return '<article class="item">' +
        '<a class="item__link" href="note.html?id=' + i + '">' +
          '<div class="item__frame">' +
            (count > 1 ? '<span class="item__count">' + count + ' 张</span>' : '') +
            '<img src="' + esc(cover) + '" alt="' + esc(g.name || '鞋履照片') + '" ' +
                 'loading="' + (i < 3 ? 'eager' : 'lazy') + '" decoding="async">' +
          '</div>' +
        '</a>' +
        '<div class="item__cap">' +
          (g.name ? '<h3 class="item__name">' + esc(g.name) + '</h3>' : '') +
          (g.note ? '<p class="item__note">' + esc(g.note) + '</p>' : '') +
          '<a class="item__more" href="note.html?id=' + i + '">看笔记 →</a>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  /* ---------------- 笔记页 ---------------- */
  function renderNote() {
    var box = $('#note');
    if (!box) return;

    var id = +(param('id') || 0);
    var g = state.shoes[id] || state.shoes[0];
    if (!g) { box.innerHTML = '<div class="empty">没有找到这篇笔记。</div>'; return; }

    document.title = (g.name || '笔记') + ' · ' + (state.site.brandCn || '');

    var total = g.images.length;
    var sections = (Array.isArray(g.sections) && g.sections.length) ? g.sections : null;

    var html = '';

    // 封面
    html += '<a class="note__cover" href="' + esc(g.images[0]) + '" data-lb="' + esc(g.images[0]) + '">' +
              '<img src="' + esc(g.images[0]) + '" alt="' + esc(g.name || '') + '" decoding="async">' +
            '</a>';

    // 标题区
    html += '<div class="note__head">' +
              '<p class="label">NOTE · ' + String(id + 1).padStart(2, '0') + ' / ' + String(state.shoes.length).padStart(2, '0') + '</p>' +
              (g.name ? '<h1 class="h1" style="font-size:clamp(22px,3vw,32px)">' + esc(g.name) + '</h1>' : '') +
              (g.note ? '<p class="lede" style="margin-top:18px">' + esc(g.note) + '</p>' : '') +
              '<p class="tiny" style="margin-top:22px">共 ' + total + ' 张 · 点任意图片可放大</p>' +
            '</div>';

    // 分段图文
    if (sections) {
      html += '<div class="note__body">' + sections.map(function (sec) {
        var cap = (sec.caption ? '<h2 class="sec__cap">' + esc(sec.caption) + '</h2>' : '');
        var txt = (sec.text ? '<p class="sec__text">' + esc(sec.text) + '</p>' : '');
        var imgs = (sec.images || []).map(function (src) {
          return '<a class="shot" href="' + esc(src) + '" data-lb="' + esc(src) + '">' +
                   '<img src="' + esc(src) + '" alt="' + esc(sec.caption || '') + '" loading="lazy" decoding="async">' +
                 '</a>';
        }).join('');
        return '<section class="sec">' +
                 (cap || txt ? '<div class="sec__txt">' + cap + txt + '</div>' : '') +
                 '<div class="sec__imgs' + ((sec.images || []).length > 1 ? ' sec__imgs--multi' : '') + '">' + imgs + '</div>' +
               '</section>';
      }).join('') + '</div>';
    } else {
      // 没分段时：封面之后把剩余的图排成两列
      var rest = g.images.slice(1);
      if (rest.length) {
        html += '<div class="note__body"><div class="sec__imgs sec__imgs--multi">' +
          rest.map(function (src) {
            return '<a class="shot" href="' + esc(src) + '" data-lb="' + esc(src) + '">' +
                     '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async"></a>';
          }).join('') + '</div></div>';
      }
    }

    // 其他笔记
    if (state.shoes.length > 1) {
      html += '<section class="note__more"><p class="label">MORE NOTES</p><div class="grid grid--mini">' +
        state.shoes.map(function (o, i) {
          if (i === id) return '';
          return '<a class="mini" href="note.html?id=' + i + '">' +
                   '<div class="mini__frame"><img src="' + esc(o.images[0]) + '" alt="" loading="lazy"></div>' +
                   '<p class="mini__name">' + esc(o.name || '') + '</p>' +
                 '</a>';
        }).join('') + '</div></section>';
    }

    box.innerHTML = html;

    // 上一篇 / 下一篇
    var nav = $('#note-nav');
    if (nav && state.shoes.length > 1) {
      var prev = (id - 1 + state.shoes.length) % state.shoes.length;
      var next = (id + 1) % state.shoes.length;
      nav.innerHTML =
        '<a href="note.html?id=' + prev + '">← ' + esc(state.shoes[prev].name || '上一篇') + '</a>' +
        '<a href="note.html?id=' + next + '">' + esc(state.shoes[next].name || '下一篇') + ' →</a>';
    }

    // 整页任意图片可点开
    box.addEventListener('click', function (e) {
      var a = e.target.closest('[data-lb]');
      if (!a) return;
      e.preventDefault();
      openLightbox(a.getAttribute('data-lb'));
    });
  }

  /* ---------------- 灯箱 ---------------- */
  function openLightbox(src) {
    var idx = 0;
    for (var i = 0; i < state.list.length; i++) {
      if (state.list[i].src === src) { idx = i; break; }
    }
    state.index = idx;
    var lb = $('#lightbox');
    if (!lb) { window.open(src, '_blank'); return; }
    paintLightbox();
    lb.classList.add('is-open');
    document.body.classList.add('is-locked');
    $('.lb__close').focus();
  }

  function closeLightbox() {
    var lb = $('#lightbox');
    if (!lb) return;
    lb.classList.remove('is-open');
    document.body.classList.remove('is-locked');
  }

  function step(delta) {
    if (!state.list.length) return;
    state.index = (state.index + delta + state.list.length) % state.list.length;
    paintLightbox();
  }

  function paintLightbox() {
    var cur = state.list[state.index];
    if (!cur) return;
    var lb = $('#lightbox');
    $('.lb__name', lb).textContent = (cur.group && cur.group.name) || '';
    var note = $('.lb__note', lb);
    var isCover = cur.group && cur.group.images[0] === cur.src;
    note.textContent = isCover === false ? '' : '';
    note.style.display = 'none';
    $('.lb__counter', lb).textContent = (state.index + 1) + ' / ' + state.list.length;
    var img = $('#lb-img');
    img.src = cur.src;
    img.alt = (cur.group && cur.group.name) || '';
    var single = state.list.length < 2;
    $('.lb__nav--prev', lb).disabled = single;
    $('.lb__nav--next', lb).disabled = single;
  }

  function bindLightbox() {
    var lb = $('#lightbox');
    if (!lb) return;
    $('.lb__close', lb).addEventListener('click', closeLightbox);
    $('.lb__nav--prev', lb).addEventListener('click', function () { step(-1); });
    $('.lb__nav--next', lb).addEventListener('click', function () { step(1); });
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lb__stage')) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
    var x0 = null;
    lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 48) step(dx > 0 ? -1 : 1);
      x0 = null;
    });
  }

  /* ---------------- 通用交互 ---------------- */
  function bindChrome() {
    var nav = $('.nav');
    if (nav) {
      var f = function () { nav.classList.toggle('is-scrolled', window.scrollY > 8); };
      f(); window.addEventListener('scroll', f, { passive: true });
    }
    var toggle = $('.nav__toggle'), menu = $('.nav__menu');
    if (toggle && menu) {
      toggle.addEventListener('click', function () { menu.classList.toggle('is-open'); });
      menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') menu.classList.remove('is-open'); });
    }
    var here = location.pathname.split('/').pop() || 'index.html';
    $$('.nav__menu a[href]').forEach(function (a) {
      var t = a.getAttribute('href').split('?')[0].split('#')[0];
      if (t === here || (here === 'index.html' && t === '')) a.classList.add('is-active');
    });
    var nb = $('.notice button');
    if (nb) nb.addEventListener('click', function () { $('.notice').style.display = 'none'; });
    var fab = $('.fab');
    if (fab) fab.addEventListener('click', function () {
      var c = $('#contact');
      if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $$('[data-copy-wechat]').forEach(function (el) {
      el.addEventListener('click', function () { copyText((state.site && state.site.wechatId) || ''); });
    });
  }

  /* ---------------- 启动 ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    bindChrome();
    bindLightbox();
    load().then(function () {
      applySite();
      renderWall();
      renderNote();
    }).catch(function (err) {
      console.error(err);
      var box = $('#wall') || $('#note');
      if (box) box.innerHTML = '<div class="empty" style="grid-column:1/-1">' +
        '数据加载失败。请通过网站地址访问（不要直接双击打开本地文件）。</div>';
    });
  });
})();
