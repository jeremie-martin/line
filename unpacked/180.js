var t = require("./18.js");
(function () {
  var t = {
    newline: /^\n+/,
    code: /^( {4}[^\n]+\n*)+/,
    fences: u,
    hr: /^( *[-*_]){3,} *(?:\n+|$)/,
    heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
    nptable: u,
    lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
    blockquote: /^( *>[^\n]+(\n(?!def)[^\n]+)*\n*)+/,
    list: /^( *)(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
    html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
    def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
    table: u,
    paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
    text: /^[^\n]+/
  };
  function n(e) {
    this.tokens = [];
    this.tokens.links = {};
    this.options = e || d.defaults;
    this.rules = t.normal;
    if (this.options.gfm) {
      if (this.options.tables) {
        this.rules = t.tables;
      } else {
        this.rules = t.gfm;
      }
    }
  }
  t.bullet = /(?:[*+-]|\d+\.)/;
  t.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/;
  t.item = l(t.item, "gm")(/bull/g, t.bullet)();
  t.list = l(t.list)(/bull/g, t.bullet)("hr", "\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))")("def", "\\n+(?=" + t.def.source + ")")();
  t.blockquote = l(t.blockquote)("def", t.def)();
  t._tag = "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b";
  t.html = l(t.html)("comment", /<!--[\s\S]*?-->/)("closed", /<(tag)[\s\S]+?<\/\1>/)("closing", /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)(/tag/g, t._tag)();
  t.paragraph = l(t.paragraph)("hr", t.hr)("heading", t.heading)("lheading", t.lheading)("blockquote", t.blockquote)("tag", "<" + t._tag)("def", t.def)();
  t.normal = c({}, t);
  t.gfm = c({}, t.normal, {
    fences: /^ *(`{3,}|~{3,})[ \.]*(\S+)? *\n([\s\S]*?)\s*\1 *(?:\n+|$)/,
    paragraph: /^/,
    heading: /^ *(#{1,6}) +([^\n]+?) *#* *(?:\n+|$)/
  });
  t.gfm.paragraph = l(t.paragraph)("(?!", "(?!" + t.gfm.fences.source.replace("\\1", "\\2") + "|" + t.list.source.replace("\\1", "\\3") + "|")();
  t.tables = c({}, t.gfm, {
    nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
    table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/
  });
  n.rules = t;
  n.lex = function (e, t) {
    return new n(t).lex(e);
  };
  n.prototype.lex = function (e) {
    e = e.replace(/\r\n|\r/g, "\n").replace(/\t/g, "    ").replace(/\u00a0/g, " ").replace(/\u2424/g, "\n");
    return this.token(e, true);
  };
  n.prototype.token = function (e, n, r) {
    var i;
    var o;
    var a;
    var s;
    var l;
    var u;
    var c;
    var d;
    var f;
    for (e = e.replace(/^ +$/gm, ""); e;) {
      if (a = this.rules.newline.exec(e)) {
        e = e.substring(a[0].length);
        if (a[0].length > 1) {
          this.tokens.push({
            type: "space"
          });
        }
      }
      if (a = this.rules.code.exec(e)) {
        e = e.substring(a[0].length);
        a = a[0].replace(/^ {4}/gm, "");
        this.tokens.push({
          type: "code",
          text: this.options.pedantic ? a : a.replace(/\n+$/, "")
        });
      } else if (a = this.rules.fences.exec(e)) {
        e = e.substring(a[0].length);
        this.tokens.push({
          type: "code",
          lang: a[2],
          text: a[3] || ""
        });
      } else if (a = this.rules.heading.exec(e)) {
        e = e.substring(a[0].length);
        this.tokens.push({
          type: "heading",
          depth: a[1].length,
          text: a[2]
        });
      } else if (n && (a = this.rules.nptable.exec(e))) {
        e = e.substring(a[0].length);
        u = {
          type: "table",
          header: a[1].replace(/^ *| *\| *$/g, "").split(/ *\| */),
          align: a[2].replace(/^ *|\| *$/g, "").split(/ *\| */),
          cells: a[3].replace(/\n$/, "").split("\n")
        };
        d = 0;
        for (; d < u.align.length; d++) {
          if (/^ *-+: *$/.test(u.align[d])) {
            u.align[d] = "right";
          } else if (/^ *:-+: *$/.test(u.align[d])) {
            u.align[d] = "center";
          } else if (/^ *:-+ *$/.test(u.align[d])) {
            u.align[d] = "left";
          } else {
            u.align[d] = null;
          }
        }
        for (d = 0; d < u.cells.length; d++) {
          u.cells[d] = u.cells[d].split(/ *\| */);
        }
        this.tokens.push(u);
      } else if (a = this.rules.lheading.exec(e)) {
        e = e.substring(a[0].length);
        this.tokens.push({
          type: "heading",
          depth: a[2] === "=" ? 1 : 2,
          text: a[1]
        });
      } else if (a = this.rules.hr.exec(e)) {
        e = e.substring(a[0].length);
        this.tokens.push({
          type: "hr"
        });
      } else if (a = this.rules.blockquote.exec(e)) {
        e = e.substring(a[0].length);
        this.tokens.push({
          type: "blockquote_start"
        });
        a = a[0].replace(/^ *> ?/gm, "");
        this.token(a, n, true);
        this.tokens.push({
          type: "blockquote_end"
        });
      } else if (a = this.rules.list.exec(e)) {
        e = e.substring(a[0].length);
        s = a[2];
        this.tokens.push({
          type: "list_start",
          ordered: s.length > 1
        });
        i = false;
        f = (a = a[0].match(this.rules.item)).length;
        d = 0;
        for (; d < f; d++) {
          c = (u = a[d]).length;
          if (~(u = u.replace(/^ *([*+-]|\d+\.) +/, "")).indexOf("\n ")) {
            c -= u.length;
            u = this.options.pedantic ? u.replace(/^ {1,4}/gm, "") : u.replace(new RegExp("^ {1," + c + "}", "gm"), "");
          }
          if (this.options.smartLists && d !== f - 1) {
            if (s !== (l = t.bullet.exec(a[d + 1])[0]) && (!(s.length > 1) || !(l.length > 1))) {
              e = a.slice(d + 1).join("\n") + e;
              d = f - 1;
            }
          }
          o = i || /\n\n(?!\s*$)/.test(u);
          if (d !== f - 1) {
            i = u.charAt(u.length - 1) === "\n";
            o ||= i;
          }
          this.tokens.push({
            type: o ? "loose_item_start" : "list_item_start"
          });
          this.token(u, false, r);
          this.tokens.push({
            type: "list_item_end"
          });
        }
        this.tokens.push({
          type: "list_end"
        });
      } else if (a = this.rules.html.exec(e)) {
        e = e.substring(a[0].length);
        this.tokens.push({
          type: this.options.sanitize ? "paragraph" : "html",
          pre: !this.options.sanitizer && (a[1] === "pre" || a[1] === "script" || a[1] === "style"),
          text: a[0]
        });
      } else if (!r && n && (a = this.rules.def.exec(e))) {
        e = e.substring(a[0].length);
        this.tokens.links[a[1].toLowerCase()] = {
          href: a[2],
          title: a[3]
        };
      } else if (n && (a = this.rules.table.exec(e))) {
        e = e.substring(a[0].length);
        u = {
          type: "table",
          header: a[1].replace(/^ *| *\| *$/g, "").split(/ *\| */),
          align: a[2].replace(/^ *|\| *$/g, "").split(/ *\| */),
          cells: a[3].replace(/(?: *\| *)?\n$/, "").split("\n")
        };
        d = 0;
        for (; d < u.align.length; d++) {
          if (/^ *-+: *$/.test(u.align[d])) {
            u.align[d] = "right";
          } else if (/^ *:-+: *$/.test(u.align[d])) {
            u.align[d] = "center";
          } else if (/^ *:-+ *$/.test(u.align[d])) {
            u.align[d] = "left";
          } else {
            u.align[d] = null;
          }
        }
        for (d = 0; d < u.cells.length; d++) {
          u.cells[d] = u.cells[d].replace(/^ *\| *| *\| *$/g, "").split(/ *\| */);
        }
        this.tokens.push(u);
      } else if (n && (a = this.rules.paragraph.exec(e))) {
        e = e.substring(a[0].length);
        this.tokens.push({
          type: "paragraph",
          text: a[1].charAt(a[1].length - 1) === "\n" ? a[1].slice(0, -1) : a[1]
        });
      } else if (a = this.rules.text.exec(e)) {
        e = e.substring(a[0].length);
        this.tokens.push({
          type: "text",
          text: a[0]
        });
      } else if (e) {
        throw new Error("Infinite loop on byte: " + e.charCodeAt(0));
      }
    }
    return this.tokens;
  };
  var r = {
    escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
    autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
    url: u,
    tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
    link: /^!?\[(inside)\]\(href\)/,
    reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
    nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
    strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
    em: /^\b_((?:[^_]|__)+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
    code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
    br: /^ {2,}\n(?!\s*$)/,
    del: u,
    text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/
  };
  function i(e, t) {
    this.options = t || d.defaults;
    this.links = e;
    this.rules = r.normal;
    this.renderer = this.options.renderer || new o();
    this.renderer.options = this.options;
    if (!this.links) {
      throw new Error("Tokens array requires a `links` property.");
    }
    if (this.options.gfm) {
      if (this.options.breaks) {
        this.rules = r.breaks;
      } else {
        this.rules = r.gfm;
      }
    } else if (this.options.pedantic) {
      this.rules = r.pedantic;
    }
  }
  function o(e) {
    this.options = e || {};
  }
  function a(e) {
    this.tokens = [];
    this.token = null;
    this.options = e || d.defaults;
    this.options.renderer = this.options.renderer || new o();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
  }
  function s(e, t) {
    return e.replace(t ? /&/g : /&(?!#?\w+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function l(e, t) {
    e = e.source;
    t = t || "";
    return function n(r, i) {
      if (r) {
        i = (i = i.source || i).replace(/(^|[^\[])\^/g, "$1");
        e = e.replace(r, i);
        return n;
      } else {
        return new RegExp(e, t);
      }
    };
  }
  function u() {}
  function c(e) {
    var t;
    var n;
    for (var r = 1; r < arguments.length; r++) {
      for (n in t = arguments[r]) {
        if (Object.prototype.hasOwnProperty.call(t, n)) {
          e[n] = t[n];
        }
      }
    }
    return e;
  }
  function d(e, t, r) {
    if (r || typeof t == "function") {
      if (!r) {
        r = t;
        t = null;
      }
      var i;
      var o;
      var l = (t = c({}, d.defaults, t || {})).highlight;
      var u = 0;
      try {
        i = n.lex(e, t);
      } catch (e) {
        return r(e);
      }
      o = i.length;
      function f(e) {
        if (e) {
          t.highlight = l;
          return r(e);
        }
        var n;
        try {
          n = a.parse(i, t);
        } catch (t) {
          e = t;
        }
        t.highlight = l;
        if (e) {
          return r(e);
        } else {
          return r(null, n);
        }
      }
      if (!l || l.length < 3) {
        return f();
      }
      delete t.highlight;
      if (!o) {
        return f();
      }
      for (; u < i.length; u++) {
        (function (e) {
          if (e.type !== "code") {
            if (! --o) {
              f();
            }
          } else {
            l(e.text, e.lang, function (t, n) {
              if (t) {
                return f(t);
              } else if (n == null || n === e.text) {
                return --o || f();
              } else {
                e.text = n;
                e.escaped = true;
                if (! --o) {
                  f();
                }
                return;
              }
            });
          }
        })(i[u]);
      }
    } else {
      try {
        t &&= c({}, d.defaults, t);
        return a.parse(n.lex(e, t), t);
      } catch (e) {
        e.message += "\nPlease report this to https://github.com/chjj/marked.";
        if ((t || d.defaults).silent) {
          return "<p>An error occured:</p><pre>" + s(e.message + "", true) + "</pre>";
        }
        throw e;
      }
    }
  }
  r._inside = /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/;
  r._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;
  r.link = l(r.link)("inside", r._inside)("href", r._href)();
  r.reflink = l(r.reflink)("inside", r._inside)();
  r.normal = c({}, r);
  r.pedantic = c({}, r.normal, {
    strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
    em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
  });
  r.gfm = c({}, r.normal, {
    escape: l(r.escape)("])", "~|])")(),
    url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
    del: /^~~(?=\S)([\s\S]*?\S)~~/,
    text: l(r.text)("]|", "~]|")("|", "|https?://|")()
  });
  r.breaks = c({}, r.gfm, {
    br: l(r.br)("{2,}", "*")(),
    text: l(r.gfm.text)("{2,}", "*")()
  });
  i.rules = r;
  i.output = function (e, t, n) {
    return new i(t, n).output(e);
  };
  i.prototype.output = function (e) {
    var t;
    for (var n, r, i, o = ""; e;) {
      if (i = this.rules.escape.exec(e)) {
        e = e.substring(i[0].length);
        o += i[1];
      } else if (i = this.rules.autolink.exec(e)) {
        e = e.substring(i[0].length);
        if (i[2] === "@") {
          n = i[1].charAt(6) === ":" ? this.mangle(i[1].substring(7)) : this.mangle(i[1]);
          r = this.mangle("mailto:") + n;
        } else {
          r = n = s(i[1]);
        }
        o += this.renderer.link(r, null, n);
      } else if (this.inLink || !(i = this.rules.url.exec(e))) {
        if (i = this.rules.tag.exec(e)) {
          if (!this.inLink && /^<a /i.test(i[0])) {
            this.inLink = true;
          } else if (this.inLink && /^<\/a>/i.test(i[0])) {
            this.inLink = false;
          }
          e = e.substring(i[0].length);
          o += this.options.sanitize ? this.options.sanitizer ? this.options.sanitizer(i[0]) : s(i[0]) : i[0];
        } else if (i = this.rules.link.exec(e)) {
          e = e.substring(i[0].length);
          this.inLink = true;
          o += this.outputLink(i, {
            href: i[2],
            title: i[3]
          });
          this.inLink = false;
        } else if ((i = this.rules.reflink.exec(e)) || (i = this.rules.nolink.exec(e))) {
          e = e.substring(i[0].length);
          t = (i[2] || i[1]).replace(/\s+/g, " ");
          if (!(t = this.links[t.toLowerCase()]) || !t.href) {
            o += i[0].charAt(0);
            e = i[0].substring(1) + e;
            continue;
          }
          this.inLink = true;
          o += this.outputLink(i, t);
          this.inLink = false;
        } else if (i = this.rules.strong.exec(e)) {
          e = e.substring(i[0].length);
          o += this.renderer.strong(this.output(i[2] || i[1]));
        } else if (i = this.rules.em.exec(e)) {
          e = e.substring(i[0].length);
          o += this.renderer.em(this.output(i[2] || i[1]));
        } else if (i = this.rules.code.exec(e)) {
          e = e.substring(i[0].length);
          o += this.renderer.codespan(s(i[2], true));
        } else if (i = this.rules.br.exec(e)) {
          e = e.substring(i[0].length);
          o += this.renderer.br();
        } else if (i = this.rules.del.exec(e)) {
          e = e.substring(i[0].length);
          o += this.renderer.del(this.output(i[1]));
        } else if (i = this.rules.text.exec(e)) {
          e = e.substring(i[0].length);
          o += this.renderer.text(s(this.smartypants(i[0])));
        } else if (e) {
          throw new Error("Infinite loop on byte: " + e.charCodeAt(0));
        }
      } else {
        e = e.substring(i[0].length);
        r = n = s(i[1]);
        o += this.renderer.link(r, null, n);
      }
    }
    return o;
  };
  i.prototype.outputLink = function (e, t) {
    var n = s(t.href);
    var r = t.title ? s(t.title) : null;
    if (e[0].charAt(0) !== "!") {
      return this.renderer.link(n, r, this.output(e[1]));
    } else {
      return this.renderer.image(n, r, s(e[1]));
    }
  };
  i.prototype.smartypants = function (e) {
    if (this.options.smartypants) {
      return e.replace(/---/g, "—").replace(/--/g, "–").replace(/(^|[-\u2014/(\[{"\s])'/g, "$1‘").replace(/'/g, "’").replace(/(^|[-\u2014/(\[{\u2018\s])"/g, "$1“").replace(/"/g, "”").replace(/\.{3}/g, "…");
    } else {
      return e;
    }
  };
  i.prototype.mangle = function (e) {
    if (!this.options.mangle) {
      return e;
    }
    var t;
    var n = "";
    for (var r = e.length, i = 0; i < r; i++) {
      t = e.charCodeAt(i);
      if (Math.random() > 0.5) {
        t = "x" + t.toString(16);
      }
      n += "&#" + t + ";";
    }
    return n;
  };
  o.prototype.code = function (e, t, n) {
    if (this.options.highlight) {
      var r = this.options.highlight(e, t);
      if (r != null && r !== e) {
        n = true;
        e = r;
      }
    }
    if (t) {
      return "<pre><code class=\"" + this.options.langPrefix + s(t, true) + "\">" + (n ? e : s(e, true)) + "\n</code></pre>\n";
    } else {
      return "<pre><code>" + (n ? e : s(e, true)) + "\n</code></pre>";
    }
  };
  o.prototype.blockquote = function (e) {
    return "<blockquote>\n" + e + "</blockquote>\n";
  };
  o.prototype.html = function (e) {
    return e;
  };
  o.prototype.heading = function (e, t, n) {
    return "<h" + t + " id=\"" + this.options.headerPrefix + n.toLowerCase().replace(/[^\w]+/g, "-") + "\">" + e + "</h" + t + ">\n";
  };
  o.prototype.hr = function () {
    if (this.options.xhtml) {
      return "<hr/>\n";
    } else {
      return "<hr>\n";
    }
  };
  o.prototype.list = function (e, t) {
    var n = t ? "ol" : "ul";
    return "<" + n + ">\n" + e + "</" + n + ">\n";
  };
  o.prototype.listitem = function (e) {
    return "<li>" + e + "</li>\n";
  };
  o.prototype.paragraph = function (e) {
    return "<p>" + e + "</p>\n";
  };
  o.prototype.table = function (e, t) {
    return "<table>\n<thead>\n" + e + "</thead>\n<tbody>\n" + t + "</tbody>\n</table>\n";
  };
  o.prototype.tablerow = function (e) {
    return "<tr>\n" + e + "</tr>\n";
  };
  o.prototype.tablecell = function (e, t) {
    var n = t.header ? "th" : "td";
    return (t.align ? "<" + n + " style=\"text-align:" + t.align + "\">" : "<" + n + ">") + e + "</" + n + ">\n";
  };
  o.prototype.strong = function (e) {
    return "<strong>" + e + "</strong>";
  };
  o.prototype.em = function (e) {
    return "<em>" + e + "</em>";
  };
  o.prototype.codespan = function (e) {
    return "<code>" + e + "</code>";
  };
  o.prototype.br = function () {
    if (this.options.xhtml) {
      return "<br/>";
    } else {
      return "<br>";
    }
  };
  o.prototype.del = function (e) {
    return "<del>" + e + "</del>";
  };
  o.prototype.link = function (e, t, n) {
    if (this.options.sanitize) {
      try {
        var r = decodeURIComponent((i = e, i.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/g, function (e, t) {
          if ((t = t.toLowerCase()) === "colon") {
            return ":";
          } else if (t.charAt(0) === "#") {
            if (t.charAt(1) === "x") {
              return String.fromCharCode(parseInt(t.substring(2), 16));
            } else {
              return String.fromCharCode(+t.substring(1));
            }
          } else {
            return "";
          }
        }))).replace(/[^\w:]/g, "").toLowerCase();
      } catch (e) {
        return "";
      }
      if (r.indexOf("javascript:") === 0 || r.indexOf("vbscript:") === 0) {
        return "";
      }
    }
    var i;
    var o = "<a href=\"" + e + "\"";
    if (t) {
      o += " title=\"" + t + "\"";
    }
    return o += ">" + n + "</a>";
  };
  o.prototype.image = function (e, t, n) {
    var r = "<img src=\"" + e + "\" alt=\"" + n + "\"";
    if (t) {
      r += " title=\"" + t + "\"";
    }
    return r += this.options.xhtml ? "/>" : ">";
  };
  o.prototype.text = function (e) {
    return e;
  };
  a.parse = function (e, t, n) {
    return new a(t, n).parse(e);
  };
  a.prototype.parse = function (e) {
    this.inline = new i(e.links, this.options, this.renderer);
    this.tokens = e.reverse();
    var t = "";
    while (this.next()) {
      t += this.tok();
    }
    return t;
  };
  a.prototype.next = function () {
    return this.token = this.tokens.pop();
  };
  a.prototype.peek = function () {
    return this.tokens[this.tokens.length - 1] || 0;
  };
  a.prototype.parseText = function () {
    var e = this.token.text;
    while (this.peek().type === "text") {
      e += "\n" + this.next().text;
    }
    return this.inline.output(e);
  };
  a.prototype.tok = function () {
    switch (this.token.type) {
      case "space":
        return "";
      case "hr":
        return this.renderer.hr();
      case "heading":
        return this.renderer.heading(this.inline.output(this.token.text), this.token.depth, this.token.text);
      case "code":
        return this.renderer.code(this.token.text, this.token.lang, this.token.escaped);
      case "table":
        var e;
        var t;
        var n;
        var r;
        var i = "";
        var o = "";
        n = "";
        e = 0;
        for (; e < this.token.header.length; e++) {
          ({
            header: true,
            align: this.token.align[e]
          });
          n += this.renderer.tablecell(this.inline.output(this.token.header[e]), {
            header: true,
            align: this.token.align[e]
          });
        }
        i += this.renderer.tablerow(n);
        e = 0;
        for (; e < this.token.cells.length; e++) {
          t = this.token.cells[e];
          n = "";
          r = 0;
          for (; r < t.length; r++) {
            n += this.renderer.tablecell(this.inline.output(t[r]), {
              header: false,
              align: this.token.align[r]
            });
          }
          o += this.renderer.tablerow(n);
        }
        return this.renderer.table(i, o);
      case "blockquote_start":
        for (o = ""; this.next().type !== "blockquote_end";) {
          o += this.tok();
        }
        return this.renderer.blockquote(o);
      case "list_start":
        o = "";
        var a = this.token.ordered;
        while (this.next().type !== "list_end") {
          o += this.tok();
        }
        return this.renderer.list(o, a);
      case "list_item_start":
        for (o = ""; this.next().type !== "list_item_end";) {
          o += this.token.type === "text" ? this.parseText() : this.tok();
        }
        return this.renderer.listitem(o);
      case "loose_item_start":
        for (o = ""; this.next().type !== "list_item_end";) {
          o += this.tok();
        }
        return this.renderer.listitem(o);
      case "html":
        var s = this.token.pre || this.options.pedantic ? this.token.text : this.inline.output(this.token.text);
        return this.renderer.html(s);
      case "paragraph":
        return this.renderer.paragraph(this.inline.output(this.token.text));
      case "text":
        return this.renderer.paragraph(this.parseText());
    }
  };
  u.exec = u;
  d.options = d.setOptions = function (e) {
    c(d.defaults, e);
    return d;
  };
  d.defaults = {
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: false,
    sanitizer: null,
    mangle: true,
    smartLists: false,
    silent: false,
    highlight: null,
    langPrefix: "lang-",
    smartypants: false,
    headerPrefix: "",
    renderer: new o(),
    xhtml: false
  };
  d.Parser = a;
  d.parser = a.parse;
  d.Renderer = o;
  d.Lexer = n;
  d.lexer = n.lex;
  d.InlineLexer = i;
  d.inlineLexer = i.output;
  d.parse = d;
  module.exports = d;
}).call(function () {
  return this || (typeof window != "undefined" ? window : t);
}());