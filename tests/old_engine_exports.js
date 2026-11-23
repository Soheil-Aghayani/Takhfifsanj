(() => {
  "use strict";

  const _0x1a693c = {
    "digikala.com": ["دیجی‌کالا", "دیجیکالا", "دیجی کالا"],
    "torob.com": ["ترب"],
    "emalls.ir": ["ای‌مالز", "ایمالز", "امالز"],
    "technolife.com": ["تکنولایف", "تکنو لایف"],
    "basalam.com": ["باسلام"],
    "banimode.com": ["بانی‌مد", "بانی مد"],
    "okala.com": ["اکالا"],
    "mobile140.com": ["موبایل ۱۴۰", "موبایل140"],
    "digistyle.com": ["دیجی‌استایل", "دیجی استایل"]
  };
  const _0x5911f1 = 9000;
  const _0x18423b = 15000;
  const _0x2c0b27 = new Set(["با", "و", "در", "از", "برای", "خرید", "قیمت", "مدل", "اصل", "جدید", "تومان", "ریال", "the", "and", "for", "new"]);
  const _0x62969c = [/^\s*خرید\s+/, /\s*(با|در)\s*قیمت\s*(روز|مناسب|ارزان|عمده)?.*$/, /\s*خرید\s*(آنلاین|اینترنتی|قسطی|اقساطی).*$/, /\s*(ارسال\s*رایگان|تخفیف|گارانتی|اصل|اورجینال).*$/];
  const _0x2b5b1c = /ارزان|گران|تخفیف|پیشنهاد|قسط|ماه|سود|بخرید|اعتبار/;
  const _0x16a090 = _0x2e5054 => console.log("[GHAFEL]", _0x2e5054);
  const _0x3986f3 = {
    greenDeep: "#1B5E20",
    brown: "#5D4037",
    ink: "#1F2A1F",
    up: "#C62828",
    down: "#1B7F3B"
  };
  const _0x477c47 = "background:rgba(255,255,255,0.20);backdrop-filter:blur(18px) saturate(180%);-webkit-backdrop-filter:blur(18px) saturate(180%);border:1px solid rgba(255,255,255,0.45);box-shadow:0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.55)";
  const _0x3de9e2 = _0x4a05f3 => String(_0x4a05f3 || "").replace(/[۰-۹]/g, _0x5c8f5c => "۰۱۲۳۴۵۶۷۸۹".indexOf(_0x5c8f5c)).replace(/[٠-٩]/g, _0x4b67bd => "٠١٢٣٤٥٦٧٨٩".indexOf(_0x4b67bd));
  const _0x28ee97 = _0xcabf07 => _0x3de9e2(_0xcabf07).replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u064B-\u0652\u0640\u200c\u200e\u200f]/g, " ").replace(/[^a-zA-Z0-9آ-ی]+/g, " ").toLowerCase().trim();
  const _0x3a56c1 = _0x452c16 => _0x28ee97(_0x452c16).replace(/\s+/g, "");
  function _0x217036(_0x45dff3) {
    return _0x28ee97(_0x45dff3).split(" ").filter(_0x1e1cbd => _0x1e1cbd.length > 1 && !_0x2c0b27.has(_0x1e1cbd));
  }
  const _0x5d2639 = Object.keys(_0x1a693c).flatMap(_0x4e2613 => [_0x3a56c1(_0x4e2613.split(".")[0]), ..._0x1a693c[_0x4e2613].map(_0x3a56c1)]).filter(_0xd7e5ae => _0xd7e5ae.length >= 4);
  const _0x4dbdc9 = _0x4a183a => {
    const _0x20f4a0 = _0x3a56c1(_0x4a183a);
    return !!_0x20f4a0 && _0x5d2639.some(_0x4ceea8 => _0x20f4a0 === _0x4ceea8 || _0x20f4a0.includes(_0x4ceea8));
  };
  const _0x366cba = _0xbc3b97 => {
    const _0x30c925 = _0x3de9e2(_0xbc3b97);
    return /\d/.test(_0x30c925) && /گرم|کیلو|میلی|لیتر|عدد|بسته|سانتی|متر|سی.?سی|\b(ml|kg|g|l|gr|cm|mm)\b/i.test(_0x30c925);
  };
  function _0x3281e9(_0x229fab) {
    const _0x132456 = String(_0x229fab || "").split(/\s*[|—–]\s*|\s+-\s+/).map(_0x1faf84 => _0x1faf84.trim()).filter(Boolean);
    let _0x2f02b4 = _0x132456.filter((_0x1c06e0, _0x2e22ba) => _0x2e22ba === 0 || !_0x4dbdc9(_0x1c06e0) && _0x366cba(_0x1c06e0)).join(" - ").replace(/\d[\d٬,،\s]*\s*(تومان|تومن|ت)\b.*$/u, "").replace(/\s+/g, " ").trim();
    for (const _0x1410fa of _0x62969c) {
      _0x2f02b4 = _0x2f02b4.replace(_0x1410fa, "").trim();
    }
    return _0x2f02b4.slice(0, 120);
  }
  function _0x352d4d() {
    try {
      const _0x259ee8 = decodeURIComponent(location.pathname).split("/").filter(Boolean).pop() || "";
      const _0x74bf37 = _0x259ee8.replace(/^\d+[-_]?/, "").replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
      if (/[آ-ی]/.test(_0x74bf37) && _0x74bf37.split(" ").length >= 3) {
        return _0x74bf37;
      } else {
        return "";
      }
    } catch (_0x50d560) {
      return "";
    }
  }
  function _0x22a579(_0x2ffdf4, _0xbe5aea) {
    const _0x351493 = _0x217036(_0x2ffdf4);
    if (!_0x351493.length) {
      return false;
    }
    const _0x58151b = _0x28ee97(_0xbe5aea);
    const _0x223d51 = new Set(_0x58151b.split(" "));
    const _0x483ec9 = _0x58151b.replace(/\s+/g, "");
    const _0x1004b4 = _0x351493.filter(_0x29f17b => _0x223d51.has(_0x29f17b) || _0x29f17b.length >= 4 && _0x483ec9.includes(_0x29f17b)).length;
    if (_0x1004b4 / _0x351493.length < 0.5) {
      return false;
    }
    const _0x2b5238 = _0x351493.filter(_0x41ea9e => /\d/.test(_0x41ea9e) && /[a-z]/.test(_0x41ea9e));
    return _0x2b5238.every(_0x60e345 => _0x483ec9.includes(_0x60e345));
  }
  function _0x5bed06(_0x201c7a) {
    const _0x4e48f3 = _0x3de9e2(_0x201c7a).replace(/[\u200c\u200e\u200f\u00a0]/g, "").replace(/[٬،]/g, ",");
    const _0x31e1fc = /(\d{1,3}(?:,\d{3})+|\d{5,})\s*(تومان|تومن|ریال|ت)(?![آ-ی])/g;
    const _0x518839 = [];
    let _0x1a01f2;
    while (_0x1a01f2 = _0x31e1fc.exec(_0x4e48f3)) {
      const _0x4a51c7 = Number(_0x1a01f2[1].replace(/\D/g, ""));
      if (_0x4a51c7 >= 1000) {
        _0x518839.push(_0x1a01f2[2] === "ریال" ? Math.round(_0x4a51c7 / 10) : _0x4a51c7);
      }
    }
    return _0x518839;
  }
  const _0xde1414 = /line-through|strikethrough|(^|[\s_:-])(old|del|strike|discount)(?=$|[\s_:-])/i;
  const _0x4d13d5 = _0x4cea7b => {
    if (_0xde1414.test(_0x4cea7b.className && _0x4cea7b.className.toString ? _0x4cea7b.className.toString() : "")) {
      return true;
    }
    try {
      if ((getComputedStyle(_0x4cea7b).textDecorationLine || "").includes("line-through")) {
        return true;
      }
    } catch (_0xf9a6dc) {}
    return !!_0x4cea7b.closest("del, s, strike");
  };
  function _0x5e0df5(_0x5bf817) {
    const _0x8a1e22 = _0x3de9e2(_0x5bf817).replace(/[\u200c\u200e\u200f\u00a0]/g, "").replace(/[٬،]/g, ",");
    const _0x3adb3b = /(?<![\d,.])(\d{1,3}(?:,\d{3})+|\d{5,})(?![\d,])/g;
    const _0x36f560 = [];
    let _0x18826e;
    while (_0x18826e = _0x3adb3b.exec(_0x8a1e22)) {
      _0x36f560.push(Number(_0x18826e[1].replace(/\D/g, "")));
    }
    return _0x36f560;
  }
  function _0x99b930(_0x35aeb8) {
    const _0x1d98db = new Set();
    _0x35aeb8.querySelectorAll("*").forEach(_0x25a643 => {
      if (_0x4d13d5(_0x25a643)) {
        _0x5e0df5(_0x25a643.textContent).forEach(_0x91ce42 => _0x1d98db.add(_0x91ce42));
      }
    });
    return _0x1d98db;
  }
  function _0x3041d4(_0x5a6d2b) {
    const _0x551e92 = _0x3de9e2(document.body.innerText || "").replace(/(\d)[,٬،](?=\d)/g, "$1");
    return new RegExp("(?<!\\d)" + _0x5a6d2b + "(?!\\d)").test(_0x551e92);
  }
  function _0x339697() {
    const _0x169ddd = [...document.querySelectorAll("button, a, div, span")].filter(_0xacb831 => {
      if (_0xacb831.children.length > 4) {
        return false;
      }
      const _0x56b445 = (_0xacb831.innerText || "").trim();
      return _0x56b445.length > 0 && _0x56b445.length < 30 && /افزودن به سبد/.test(_0x56b445);
    });
    for (const _0x38885a of _0x169ddd) {
      let _0x59eb55 = _0x38885a.parentElement;
      for (let _0x58c3d4 = 0; _0x58c3d4 < 6 && _0x59eb55; _0x58c3d4++, _0x59eb55 = _0x59eb55.parentElement) {
        const _0x27ca23 = _0x59eb55.innerText || "";
        if (_0x27ca23.length > 500) {
          break;
        }
        const _0x2460f5 = _0x99b930(_0x59eb55);
        const _0x2dc524 = _0x5e0df5(_0x27ca23).filter(_0x2c7574 => _0x2c7574 >= 10000 && !_0x2460f5.has(_0x2c7574));
        if (_0x2dc524.length) {
          return Math.min(..._0x2dc524);
        }
      }
    }
    return null;
  }
  function _0x123019(_0x17d657) {
    let _0x236dbb = null;
    _0x17d657.querySelectorAll("script[type=\"application/ld+json\"]").forEach(_0x277edd => {
      if (_0x236dbb) {
        return;
      }
      let _0x435b4d;
      try {
        _0x435b4d = JSON.parse(_0x277edd.textContent);
      } catch (_0x2af0e1) {
        return;
      }
      (function _0x2869d7(_0x4c2152) {
        if (!_0x4c2152 || typeof _0x4c2152 !== "object" || _0x236dbb) {
          return;
        }
        if (Array.isArray(_0x4c2152)) {
          _0x4c2152.forEach(_0x2869d7);
          return;
        }
        const _0x3cb132 = _0x4c2152["@type"];
        if (_0x3cb132 === "Product" || Array.isArray(_0x3cb132) && _0x3cb132.includes("Product")) {
          let _0x263cb2 = 0;
          let _0x2be08a = "";
          for (const _0x7d6936 of [].concat(_0x4c2152.offers || [])) {
            const _0x54d692 = _0x7d6936 && _0x7d6936.offers ? [].concat(_0x7d6936.offers)[0] : _0x7d6936;
            const _0x242220 = Number(String(_0x54d692?.price ?? _0x54d692?.lowPrice ?? "").replace(/[^\d.]/g, ""));
            if (_0x242220 > 0) {
              _0x263cb2 = _0x242220;
              _0x2be08a = String(_0x54d692.priceCurrency || "").toUpperCase();
              break;
            }
          }
          _0x236dbb = {
            name: _0x4c2152.name || "",
            raw: _0x263cb2 || null,
            cur: _0x2be08a
          };
          return;
        }
        Object.values(_0x4c2152).forEach(_0x2869d7);
      })(_0x435b4d);
    });
    return _0x236dbb;
  }
  function _0x3636a2(_0x1e0476, _0x1046f7) {
    if (!_0x1e0476 || !_0x1e0476.raw) {
      return null;
    }
    const _0x46bfc1 = _0x1e0476.cur === "IRR" ? Math.round(_0x1e0476.raw / 10) : Math.round(_0x1e0476.raw);
    const _0x57aa8c = Math.round(_0x1e0476.raw);
    const _0x483eaf = Math.round(_0x1e0476.raw / 10);
    if (!_0x1046f7) {
      if (!_0x3041d4(_0x46bfc1)) {
        if (_0x3041d4(_0x57aa8c)) {
          return {
            price: _0x57aa8c,
            note: " (واحد JSON-LD اصلاح شد)"
          };
        }
        if (_0x3041d4(_0x483eaf)) {
          return {
            price: _0x483eaf,
            note: " (واحد JSON-LD اصلاح شد)"
          };
        }
      }
      const _0x4399c4 = {
        price: _0x46bfc1,
        note: ""
      };
      return _0x4399c4;
    }
    const _0xd2174b = _0xaa6dbe => Math.abs(_0xaa6dbe - _0x1046f7) / _0x1046f7 < 0.02;
    if (_0xd2174b(_0x46bfc1)) {
      return {
        price: _0x46bfc1,
        note: ""
      };
    }
    if (_0xd2174b(_0x57aa8c)) {
      return {
        price: _0x57aa8c,
        note: " (واحد JSON-LD اصلاح شد)"
      };
    }
    if (_0xd2174b(_0x483eaf)) {
      return {
        price: _0x483eaf,
        note: " (واحد JSON-LD اصلاح شد)"
      };
    }
    return null;
  }
  function _0xcceea2() {
    const _0x3a803f = [...document.querySelectorAll("[data-testid=\"price-final\"], [data-testid=\"price-current\"], [data-testid=\"price\"]")];
    for (const _0x538e35 of _0x3a803f) {
      if (_0x538e35.closest("[data-testid*='seller'], [class*='seller']")) {
        continue;
      }
      const _0x31e175 = _0x5bed06((_0x538e35.innerText || _0x538e35.textContent || "") + " تومان");
      if (_0x31e175.length) {
        return Math.min(..._0x31e175);
      }
      const _0x42df26 = Number(_0x3de9e2(_0x538e35.textContent).replace(/\D/g, ""));
      if (_0x42df26 >= 10000) {
        return _0x42df26;
      }
    }
    return null;
  }
  function _0x156cd3() {
    const _0xba3154 = [...document.querySelectorAll("[class*='price'], [data-testid*='price'], [id*='price']")].filter(_0x533390 => {
      if (_0x533390.closest("[data-testid*='seller'], [class*='seller'], [class*='related'], [class*='similar']")) {
        return false;
      }
      if (_0x4d13d5(_0x533390)) {
        return false;
      }
      return /^\d{1,3}(?:[,٬،]\d{3})+$|^\d{5,}$/.test(_0x3de9e2(_0x533390.textContent).replace(/\s|تومان|ت$/g, "").trim());
    });
    const _0x4b79c3 = _0xba3154.map(_0x901472 => ({
      top: _0x901472.getBoundingClientRect().top + window.scrollY,
      value: Number(_0x3de9e2(_0x901472.textContent).replace(/\D/g, ""))
    })).filter(_0x3c08c5 => _0x3c08c5.value >= 10000);
    _0x4b79c3.sort((_0x261599, _0x16d9bd) => _0x261599.top - _0x16d9bd.top);
    if (_0x4b79c3.length) {
      return _0x4b79c3[0].value;
    } else {
      return null;
    }
  }
  function _0x1ce445() {
    const _0x2490f1 = [...document.querySelectorAll("p, span, div, strong, b")].filter(_0x2f0328 => {
      if (_0x2f0328.children.length !== 0) {
        return false;
      }
      const _0x1dd4c1 = _0x3de9e2(_0x2f0328.textContent).trim();
      if (!/^\d{1,3}(?:[,٬]\d{3})+$/.test(_0x1dd4c1)) {
        return false;
      }
      if (_0x4d13d5(_0x2f0328)) {
        return false;
      }
      if (_0x2f0328.closest("[data-testid*='seller'], [class*='seller'], [class*='related'], [class*='similar']")) {
        return false;
      }
      const _0x1554ea = Number(_0x1dd4c1.replace(/\D/g, ""));
      return _0x1554ea >= 100000 && _0x1554ea <= 100000000;
    });
    const _0x1b15ff = _0x2490f1.map(_0x2fac19 => {
      const _0x27029f = _0x2fac19.className.toString();
      const _0x663eda = /font-semibold|font-bold|text-h4|text-xl|text-primary/.test(_0x27029f) ? 2 : 0;
      return {
        value: Number(_0x3de9e2(_0x2fac19.textContent).replace(/\D/g, "")),
        score: _0x663eda
      };
    });
    _0x1b15ff.sort((_0x52fe42, _0x39d5cc) => _0x39d5cc.score - _0x52fe42.score);
    if (_0x1b15ff.length) {
      return _0x1b15ff[0].value;
    } else {
      return null;
    }
  }
  function _0x114d63() {
    const _0x47283e = [...document.querySelectorAll("button, a, div")].filter(_0x58ccd2 => {
      const _0xd91087 = (_0x58ccd2.innerText || "").trim();
      return _0xd91087.length > 0 && _0xd91087.length < 40 && /افزودن به سبد|خرید/.test(_0xd91087);
    });
    for (const _0x1b1824 of _0x47283e) {
      let _0x72d28d = _0x1b1824;
      for (let _0x33be21 = 0; _0x33be21 < 8 && _0x72d28d; _0x33be21++) {
        const _0x25bc97 = _0x72d28d.innerText || "";
        if (_0x25bc97.length < 400) {
          const _0xda4a2d = _0x5bed06(_0x25bc97.split("\n").filter(_0x4dbec9 => !_0x2b5b1c.test(_0x4dbec9)).join("\n"));
          if (_0xda4a2d.length) {
            return Math.min(..._0xda4a2d);
          }
        }
        _0x72d28d = _0x72d28d.parentElement;
      }
    }
    return null;
  }
  function _0x52f98d(_0x211f22) {
    const _0x201bb6 = _0x123019(_0x211f22) || {};
    const _0x1dbf4d = _0x4d6b51 => _0x211f22.querySelector(_0x4d6b51)?.getAttribute("content") || "";
    const _0x3ccd86 = _0x211f22.querySelector("h1")?.textContent?.trim() || "";
    const _0x10f556 = [_0x3ccd86, _0x201bb6.name, _0x1dbf4d("meta[property=\"og:title\"]"), _0x211f22.title, _0x352d4d()].map(_0x3281e9).filter(_0x54bf5c => _0x54bf5c && !_0x4dbdc9(_0x54bf5c) && !/^فروشگاه\s*اینترنتی/.test(_0x54bf5c));
    let _0x572dcf = _0x10f556[0] || "";
    if (_0x217036(_0x572dcf).length < 3) {
      const _0x59656e = _0x10f556.find(_0x5f214c => _0x217036(_0x5f214c).length >= 3);
      if (_0x59656e) {
        _0x572dcf = _0x59656e;
      }
    }
    const _0x39a92d = _0x28ee97(_0x572dcf);
    for (const _0x1f4614 of _0x10f556) {
      const _0xf1cc25 = _0x28ee97(_0x1f4614);
      if (_0x39a92d && _0xf1cc25.length > _0x39a92d.length && _0xf1cc25.includes(_0x39a92d) && _0x1f4614.length <= 120) {
        _0x572dcf = _0x1f4614;
        break;
      }
    }
    _0x16a090("کاندیدهای نام: " + JSON.stringify(_0x10f556));
    let _0x4ca80b = null;
    let _0x4c408a = "";
    const _0x3c1472 = _0x339697();
    const _0x409e3d = _0x3636a2(_0x201bb6, _0x3c1472);
    if (_0x409e3d) {
      _0x4ca80b = _0x409e3d.price;
      _0x4c408a = "JSON-LD" + _0x409e3d.note;
    }
    if (!_0x4ca80b && _0x3c1472) {
      _0x4ca80b = _0x3c1472;
      _0x4c408a = "نوار خرید";
    }
    if (!_0x4ca80b) {
      const _0x22257c = Number(_0x1dbf4d("meta[property=\"product:price:amount\"]").replace(/[^\d]/g, ""));
      if (_0x22257c > 0) {
        _0x4ca80b = _0x22257c;
        _0x4c408a = "متای صفحه";
      }
    }
    if (!_0x4ca80b) {
      const _0x52549f = _0xcceea2();
      if (_0x52549f) {
        _0x4ca80b = _0x52549f;
        _0x4c408a = "data-testid";
      }
    }
    if (!_0x4ca80b) {
      const _0x347729 = _0x156cd3();
      if (_0x347729) {
        _0x4ca80b = _0x347729;
        _0x4c408a = "کلاس قیمت";
      }
    }
    if (!_0x4ca80b) {
      const _0x39008a = _0x1ce445();
      if (_0x39008a) {
        _0x4ca80b = _0x39008a;
        _0x4c408a = "قیمت بدون خط‌خوردگی";
      }
    }
    if (!_0x4ca80b) {
      const _0x56da35 = _0x114d63();
      if (_0x56da35) {
        _0x4ca80b = _0x56da35;
        _0x4c408a = "نزدیک دکمهٔ خرید";
      }
    }
    _0x16a090("نام: " + _0x572dcf + " | قیمت مبدا: " + (_0x4ca80b || "پیدا نشد") + " | منبع: " + (_0x4c408a || "-") + " | JSON-LD خام: " + (_0x201bb6.raw || "-") + " " + (_0x201bb6.cur || "") + " | قیمت قابل‌مشاهده: " + (_0x3c1472 || "-"));
    const _0x33edd3 = {
      name: _0x572dcf,
      price: _0x4ca80b,
      source: _0x4c408a
    };
    return _0x33edd3;
  }
  function _0x400842(_0xff5390, _0x378e7b, _0x2166d4, _0x63a16d) {
    return new Promise((_0x1e5b26, _0x725e02) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        return _0x725e02(new Error("GM نیست"));
      }
      GM_xmlhttpRequest({
        method: "GET",
        url: _0xff5390,
        timeout: _0x63a16d || _0x5911f1,
        anonymous: true,
        headers: {
          Accept: _0x378e7b || "*/*",
          "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
          ...(_0x2166d4 ? {
            Referer: _0x2166d4
          } : {})
        },
        onload: _0x49fc08 => _0x49fc08.status === 200 ? _0x1e5b26(_0x49fc08.responseText || "") : _0x725e02(new Error("HTTP " + _0x49fc08.status)),
        onerror: _0x2e4e8a => _0x725e02(new Error("خطای شبکه" + (_0x2e4e8a && _0x2e4e8a.error ? " (" + _0x2e4e8a.error + ")" : ""))),
        ontimeout: () => _0x725e02(new Error("timeout"))
      });
    });
  }
  function _0x4205bd(_0xe7fd39) {
    const _0x57be7a = _0x3a56c1(_0xe7fd39);
    if (!_0x57be7a) {
      return null;
    }
    for (const _0x106802 of Object.keys(_0x1a693c)) {
      const _0x4942ca = _0x3a56c1(_0x106802.split(".")[0]);
      const _0x4bc5d1 = [_0x4942ca, ..._0x1a693c[_0x106802].map(_0x3a56c1)];
      for (const _0x2d78f1 of _0x4bc5d1) {
        if (!_0x2d78f1) {
          continue;
        }
        if (_0x57be7a === _0x2d78f1) {
          return _0x106802;
        }
        if (_0x2d78f1.length >= 5 && _0x57be7a.includes(_0x2d78f1)) {
          return _0x106802;
        }
      }
    }
    return null;
  }
  async function _0x183ef9(_0x4c8b28) {
    const _0x5392a3 = encodeURIComponent(_0x4c8b28);
    const _0xae808b = JSON.parse(await _0x400842("https://api.torob.com/v4/base-product/search/?page=0&sort=popularity&size=24&query=" + _0x5392a3 + "&q=" + _0x5392a3 + "&source=next_desktop", "application/json", "https://torob.com/", _0x18423b));
    const _0x4c7977 = Array.isArray(_0xae808b.results) ? _0xae808b.results : [];
    const _0x20c48d = _0xae808b.search_id || _0xae808b.searchId || "";
    _0x16a090("ترب: " + _0x4c7977.length + " نتیجهٔ جستجو، search_id=" + (_0x20c48d ? "دارد" : "ندارد"));
    const _0x4060ef = _0x4c7977.filter(_0x493551 => _0x493551 && _0x493551.name1 && !_0x493551.is_adv && Number(_0x493551.price) > 0 && _0x493551.random_key).filter(_0xe888b4 => _0x22a579(_0x4c8b28, _0xe888b4.name1 + " " + (_0xe888b4.name2 || ""))).sort((_0x2e04ab, _0x176f1a) => Number(_0x2e04ab.price) - Number(_0x176f1a.price));
    _0x16a090("ترب: " + _0x4060ef.length + " نتیجهٔ مطابق با نام محصول");
    if (!_0x4060ef.length) {
      return [];
    }
    const _0x5f4134 = _0x4060ef[0];
    const _0x3ebefd = _0x5f4134.name1 + " " + (_0x5f4134.name2 || "");
    _0x16a090("ترب: محصول انتخاب‌شده = " + _0x3ebefd);
    const _0x4335e1 = {
      source: "next_mobile",
      discover_method: "direct",
      prk: _0x5f4134.random_key,
      list_type: "products_info"
    };
    const _0x46cf3c = new URLSearchParams(_0x4335e1);
    if (_0x20c48d) {
      _0x46cf3c.set("search_id", _0x20c48d);
    }
    const _0x5852d5 = JSON.parse(await _0x400842("https://api.torob.com/v4/base-product/sellers/?" + _0x46cf3c.toString(), "application/json", "https://torob.com/", _0x18423b));
    const _0x907933 = _0x5852d5?.results || _0x5852d5?.products_info?.result || [];
    _0x16a090("ترب: " + _0x907933.length + " فروشنده در پاسخ فهرست");
    const _0x9759d8 = _0x907933.map(_0x11b3b8 => {
      const _0xd33fff = String(_0x11b3b8.shop_name || _0x11b3b8.domain || _0x11b3b8.shop_text || "").replace(/^www\./, "");
      const _0x594f4b = _0x4205bd(_0x11b3b8.domain || _0xd33fff) || _0x4205bd(_0xd33fff);
      return {
        site: _0x594f4b || _0xd33fff,
        matchedKey: _0x594f4b,
        title: _0x3ebefd,
        price: Number(_0x11b3b8.price ?? _0x11b3b8.price_value),
        url: String(_0x11b3b8.page_url || "")
      };
    }).filter(_0x1bb32e => _0x1bb32e.site && _0x1bb32e.price > 0);
    _0x16a090("ترب: " + _0x9759d8.filter(_0x352c37 => _0x352c37.matchedKey).length + " فروشنده به فروشگاه‌های شناخته‌شده وصل شد");
    const _0x1005cd = new Map();
    for (const _0x54f64e of _0x9759d8) {
      const _0x2f7fe4 = _0x1005cd.get(_0x54f64e.site);
      if (!_0x2f7fe4 || _0x54f64e.price < _0x2f7fe4.price) {
        _0x1005cd.set(_0x54f64e.site, _0x54f64e);
      }
    }
    return [..._0x1005cd.values()];
  }
  let _0x3dd503;
  let _0x2d8e0e;
  let _0x2b90a1;
  let _0x22d72d;
  let _0x41beaf = null;
  const _0x49d52c = _0x4147a1 => Math.round(_0x4147a1).toLocaleString("fa-IR");
  const _0x5d731e = (_0x46dcf8, _0x298572, _0x5d88fd) => {
    const _0x169389 = document.createElement(_0x46dcf8);
    if (_0x298572) {
      _0x169389.style.cssText = _0x298572;
    }
    if (_0x5d88fd != null) {
      _0x169389.textContent = _0x5d88fd;
    }
    return _0x169389;
  };
  async function _0x29f188() {
    if (_0x41beaf && _0x41beaf.running) {
      return;
    }
    const _0x53bb10 = _0x52f98d(document);
    const _0x26eb97 = _0x53bb10.name;
    _0x16a090("شروع مقایسه | محصول: " + _0x26eb97 + " | قیمت مبدا: " + (_0x53bb10.price || "نامشخص"));
    if (!_0x26eb97) {
      _0x2b90a1.textContent = "نام محصول در این صفحه پیدا نشد.";
      return;
    }
    const _0x21b7ae = location.hostname.replace(/^www\./, "");
    const _0x2f80ef = {
      name: _0x26eb97,
      price: _0x53bb10.price,
      host: _0x21b7ae,
      source: _0x53bb10.source
    };
    const _0x2db8f9 = {
      src: _0x2f80ef,
      rows: [],
      running: true
    };
    _0x41beaf = _0x2db8f9;
    _0x51aa47();
    let _0x249e94 = [];
    try {
      _0x249e94 = await _0x183ef9(_0x26eb97);
    } catch (_0x106fa8) {
      _0x16a090("ترب خطا: " + _0x106fa8.message);
    }
    _0x41beaf.rows.push(..._0x249e94);
    const _0x46ff59 = _0x249e94.some(_0xe1109e => _0xe1109e.matchedKey === "digikala.com");
    if (!_0x46ff59) {
      _0x16a090("دیجی‌کالا: در فهرست ترب نبود");
    }
    _0x41beaf.running = false;
    _0x16a090("پایان مقایسه | " + _0x41beaf.rows.length + " نتیجه");
    _0x51aa47();
  }
  const _0x2144f9 = "ghafel-pos-";
  function _0xacfbf0(_0x5e9a56) {
    try {
      const _0x3aaad9 = JSON.parse(localStorage.getItem(_0x2144f9 + _0x5e9a56));
      if (_0x3aaad9 && typeof _0x3aaad9.left === "number" && typeof _0x3aaad9.top === "number") {
        return _0x3aaad9;
      } else {
        return null;
      }
    } catch (_0x15b1e7) {
      return null;
    }
  }
  function _0x2bcf22(_0x3e4a5b, _0x4484c7, _0x41e603) {
    try {
      const _0x1f1a78 = {
        left: _0x4484c7,
        top: _0x41e603
      };
      localStorage.setItem(_0x2144f9 + _0x3e4a5b, JSON.stringify(_0x1f1a78));
    } catch (_0x417340) {}
  }
  function _0x4d6147(_0x45b5d6, _0x10bdea, _0x3dac7e) {
    const _0x1922c3 = Math.max(0, window.innerWidth - _0x45b5d6.offsetWidth);
    const _0x2a4a98 = Math.max(0, window.innerHeight - _0x45b5d6.offsetHeight);
    return {
      left: Math.min(Math.max(0, _0x10bdea), _0x1922c3),
      top: Math.min(Math.max(0, _0x3dac7e), _0x2a4a98)
    };
  }
  function _0x1b8581(_0x5772ca, _0x3881e9) {
    _0x5772ca.style.left = _0x3881e9.left + "px";
    _0x5772ca.style.top = _0x3881e9.top + "px";
    _0x5772ca.style.right = "auto";
    _0x5772ca.style.bottom = "auto";
  }
  function _0x4a45c3(_0x4bbc8b, _0x3ddaab, _0x258ae4, _0x52c29a) {
    const _0x5d94c6 = _0xacfbf0(_0x258ae4);
    if (_0x5d94c6) {
      _0x1b8581(_0x4bbc8b, _0x4d6147(_0x4bbc8b, _0x5d94c6.left, _0x5d94c6.top));
    }
    _0x3ddaab.style.touchAction = "none";
    _0x3ddaab.style.userSelect = "none";
    let _0x196c7c = false;
    let _0x3e211b = false;
    let _0x5455a4 = 0;
    let _0x50c695 = 0;
    let _0x36fd10 = 0;
    let _0x402290 = 0;
    _0x3ddaab.addEventListener("pointerdown", _0xc61067 => {
      _0x196c7c = true;
      _0x3e211b = false;
      _0x5455a4 = _0xc61067.clientX;
      _0x50c695 = _0xc61067.clientY;
      const _0x5e4ff2 = _0x4bbc8b.getBoundingClientRect();
      _0x36fd10 = _0x5e4ff2.left;
      _0x402290 = _0x5e4ff2.top;
      try {
        _0x3ddaab.setPointerCapture(_0xc61067.pointerId);
      } catch (_0x1f4f30) {}
    });
    _0x3ddaab.addEventListener("pointermove", _0x4e6a16 => {
      if (!_0x196c7c) {
        return;
      }
      const _0x118372 = _0x4e6a16.clientX - _0x5455a4;
      const _0x3365b0 = _0x4e6a16.clientY - _0x50c695;
      if (!_0x3e211b && Math.hypot(_0x118372, _0x3365b0) < 6) {
        return;
      }
      _0x3e211b = true;
      _0x1b8581(_0x4bbc8b, _0x4d6147(_0x4bbc8b, _0x36fd10 + _0x118372, _0x402290 + _0x3365b0));
    });
    const _0x19b913 = () => {
      if (!_0x196c7c) {
        return;
      }
      _0x196c7c = false;
      if (_0x3e211b) {
        const _0x2efc5d = _0x4bbc8b.getBoundingClientRect();
        _0x2bcf22(_0x258ae4, _0x2efc5d.left, _0x2efc5d.top);
      } else if (_0x52c29a) {
        _0x52c29a();
      }
    };
    _0x3ddaab.addEventListener("pointerup", _0x19b913);
    _0x3ddaab.addEventListener("pointercancel", () => {
      _0x196c7c = false;
    });
    window.addEventListener("resize", () => {
      const _0x55fb82 = _0x4bbc8b.getBoundingClientRect();
      _0x1b8581(_0x4bbc8b, _0x4d6147(_0x4bbc8b, _0x55fb82.left, _0x55fb82.top));
    });
  }
  const _0x3952e5 = "position:fixed;bottom:20px;left:20px;z-index:999999999;padding:12px 20px;border-radius:20px;" + _0x477c47 + ";color:" + _0x3986f3.greenDeep + ";font-weight:bold;font-size:14px;cursor:pointer;font-family:Tahoma,Arial,sans-serif;text-shadow:0 1px 2px rgba(255,255,255,0.5);touch-action:none;-webkit-tap-highlight-color:transparent";
  const _0x4414d9 = "position:fixed;bottom:86px;left:12px;z-index:999999999;width:min(370px,calc(100vw - 24px));max-height:70vh;overflow-y:auto;direction:rtl;padding:16px;border-radius:28px;" + _0x477c47 + ";font-family:Tahoma,Arial,sans-serif;font-size:13px;color:" + _0x3986f3.ink;
  const _0x507c96 = "display:flex;justify-content:space-between;align-items:center;gap:8px;padding:11px 13px;margin-bottom:8px;border-radius:18px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.4);box-shadow:inset 0 1px 0 rgba(255,255,255,0.45);text-decoration:none;color:" + _0x3986f3.ink + ";backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)";
  const _0x22ad73 = "width:100%;padding:11px;margin-top:6px;border-radius:16px;background:rgba(255,255,255,0.22);border:1px solid rgba(255,255,255,0.5);color:" + _0x3986f3.greenDeep + ";font-weight:bold;font-size:13px;cursor:pointer;";
  const _0x29e81b = "width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,0.5);background:rgba(255,255,255,0.2);color:" + _0x3986f3.ink + ";font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0";
  let _0x5a90a8;
  function _0x1581dd() {
    if (!_0x3dd503) {
      _0x4715b1();
    }
    _0x3dd503.style.display = _0x3dd503.style.display === "none" ? "block" : "none";
  }
  function _0x4715b1() {
    _0x3dd503 = _0x5d731e("div", _0x4414d9);
    _0x3dd503.style.display = "none";
    const _0x6875e2 = _0x5d731e("div", "display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;cursor:move");
    const _0x47f9d3 = _0x5d731e("div", "display:flex;flex-direction:column;gap:2px");
    const _0x1ba707 = _0x5d731e("span", "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-weight:900;font-style:italic;font-size:14px;letter-spacing:-0.4px;color:" + _0x3986f3.greenDeep + ";direction:ltr;unicode-bidi:isolate;text-align:right;text-shadow:0 1px 2px rgba(255,255,255,0.6)", "GHAFEL_com");
    _0x47f9d3.append(_0x5d731e("b", "font-size:15px;color:" + _0x3986f3.greenDeep, "مقایسه قیمت"), _0x1ba707);
    const _0x4728fc = _0x5d731e("button", _0x29e81b, "✕");
    _0x4728fc.onclick = _0x5a68cb => {
      _0x5a68cb.stopPropagation();
      _0x3dd503.style.display = "none";
    };
    _0x6875e2.append(_0x47f9d3, _0x4728fc);
    _0x22d72d = _0x5d731e("div", "font-size:12px;font-weight:bold;margin-bottom:6px;overflow-wrap:anywhere", "صفحه‌ای را باز کنید و مقایسه را شروع کنید");
    _0x2b90a1 = _0x5d731e("div", "font-size:12px;color:" + _0x3986f3.brown + ";margin-bottom:8px");
    _0x2d8e0e = _0x5d731e("div", "");
    const _0x53ad8c = _0x5d731e("button", _0x22ad73, "شروع مقایسه");
    _0x53ad8c.onclick = _0x29f188;
    _0x3dd503.append(_0x6875e2, _0x22d72d, _0x2b90a1, _0x2d8e0e, _0x53ad8c);
    document.body.appendChild(_0x3dd503);
    _0x4a45c3(_0x3dd503, _0x6875e2, "panel", null);
  }
  function _0x51aa47() {
    if (!_0x41beaf || !_0x3dd503) {
      return;
    }
    _0x2d8e0e.textContent = "";
    const _0x1d4159 = _0x41beaf.src;
    _0x22d72d.textContent = "مبدا: " + (_0x1d4159.name || "—") + " — " + (_0x1d4159.price ? _0x49d52c(_0x1d4159.price) + " تومان" : "قیمت این صفحه پیدا نشد");
    _0x2b90a1.textContent = _0x41beaf.running ? "در حال جستجو..." : _0x41beaf.rows.length + " فروشنده قیمت داد" + (_0x1d4159.source ? " | منبع مبدا: " + _0x1d4159.source : "");
    const _0xc3afc7 = [..._0x41beaf.rows];
    if (_0x1d4159.price) {
      const _0x1c91a2 = {
        site: _0x1d4159.host,
        title: "قیمت این صفحه (مبدا)",
        price: _0x1d4159.price,
        url: "",
        isSource: true
      };
      _0xc3afc7.push(_0x1c91a2);
    }
    _0xc3afc7.sort((_0x15cf86, _0x108537) => _0x15cf86.price - _0x108537.price);
    _0xc3afc7.forEach(_0x2d7885 => {
      const _0x2d8ace = _0x2d7885.url ? _0x5d731e("a", _0x507c96) : _0x5d731e("div", _0x507c96);
      if (_0x2d7885.url) {
        _0x2d8ace.href = _0x2d7885.url;
        _0x2d8ace.target = "_blank";
        _0x2d8ace.rel = "noopener";
      }
      const _0x59a013 = _0x5d731e("div", "flex:1;min-width:0");
      _0x59a013.append(_0x5d731e("div", "font-weight:bold;font-size:13px", _0x2d7885.site), _0x5d731e("div", "font-size:11px;color:" + _0x3986f3.brown + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap", _0x2d7885.title));
      const _0x2db837 = _0x5d731e("div", "text-align:left;white-space:nowrap");
      _0x2db837.append(_0x5d731e("div", "font-weight:bold;font-size:14px;color:" + _0x3986f3.greenDeep, _0x49d52c(_0x2d7885.price) + " ت"));
      if (_0x2d7885.isSource) {
        _0x2db837.append(_0x5d731e("div", "font-size:11px;color:" + _0x3986f3.brown, "مبدا"));
      } else if (_0x1d4159.price) {
        const _0x32a692 = (_0x2d7885.price - _0x1d4159.price) / _0x1d4159.price * 100;
        const _0x33bfa3 = Math.abs(_0x32a692).toFixed(1);
        let _0x26d43e;
        let _0x1fdbc7;
        if (Math.abs(_0x32a692) < 0.5) {
          _0x26d43e = "برابر با مبدا";
          _0x1fdbc7 = _0x3986f3.brown;
        } else if (_0x32a692 < 0) {
          _0x26d43e = "ارزان‌تر " + _0x33bfa3 + "٪";
          _0x1fdbc7 = _0x3986f3.down;
        } else {
          _0x26d43e = "گران‌تر " + _0x33bfa3 + "٪";
          _0x1fdbc7 = _0x3986f3.up;
        }
        _0x2db837.append(_0x5d731e("div", "font-size:11px;font-weight:bold;color:" + _0x1fdbc7, _0x26d43e));
      }
      _0x2d8ace.append(_0x59a013, _0x2db837);
      _0x2d8e0e.appendChild(_0x2d8ace);
    });
  }
  function _0x336bda() {
    if (document.getElementById("ghafel-pc-btn")) {
      return;
    }
    _0x5a90a8 = _0x5d731e("button", _0x3952e5, "مقایسه قیمت");
    _0x5a90a8.id = "ghafel-pc-btn";
    document.body.appendChild(_0x5a90a8);
    _0x4715b1();
    _0x4a45c3(_0x5a90a8, _0x5a90a8, "button", _0x1581dd);
  }
  globalThis.__old = {norm:_0x28ee97, base:_0x22a579, cur:_0x5bed06, nums:_0x5e0df5, clean:_0x3281e9, known:_0x4205bd};
})();