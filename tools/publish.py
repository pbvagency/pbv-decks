#!/usr/bin/env python3
"""Publish PBV decks to proposals.pbvagency.com and clients.pbvagency.com.

Every published page is a small PBV password page that holds the deck encrypted
(AES-256-GCM, key from PBKDF2-SHA256, 600,000 iterations) and decrypts it in the
browser. Without the password nothing is readable, not even in the page source.

Commands

  proposal   Encrypt one proposal or pitch into proposals/<slug>/index.html
             python3 tools/publish.py proposal SRC.html <slug> --client "Kind Patches" \
                 --contact Ivana --password-file pw.txt

  space      Build or rebuild a client space on clients.pbvagency.com from its
             config in tools/spaces/<client>.json: every document listed there is
             encrypted into clients/<space>/<doc>/ and the space gets a page listing
             them, all with the client's one password.
             python3 tools/publish.py space tools/spaces/les-elfes.json \
                 --password-file pw.txt --src q2-2026=/path/Q2.html --src q3-2026=/path/Q3.html

             Only the documents passed with --src are re-encrypted; the others keep
             their current encrypted file. The space page is rebuilt every time.

  newpassword  Print a new random password (xxxx-xxxx-xxxx-xxxx). Never commit it.

The config files in tools/ are outside the published folders, so they never go online.
Never commit an unencrypted deck or a password to this repository.
"""
import argparse, base64, json, os, re, secrets, sys, html as H
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
FAV = open(os.path.join(TOOLS, "assets_favicon.txt")).read().strip()
LOGO = open(os.path.join(TOOLS, "assets_logo.txt")).read().strip()
ITER = 600000
ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no 0/o, 1/l/i


def new_password():
    return "-".join("".join(secrets.choice(ALPHABET) for _ in range(4)) for _ in range(4))


def read_pw(path):
    pw = open(path).read().strip()
    assert len(pw) >= 12, "password too short"
    return pw


def encrypt(text, pw):
    salt, iv = os.urandom(16), os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER).derive(pw.encode())
    ct = AESGCM(key).encrypt(iv, text.encode("utf-8"), None)
    b = lambda x: base64.b64encode(x).decode()
    return json.dumps({"s": b(salt), "i": b(iv), "n": ITER, "c": b(ct)})


def check_deck(text, name):
    low = text.lower()
    assert low.count('name="robots"') >= 1 and "noindex" in low, f"{name}: robots noindex meta missing"


GATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta name="robots" content="noindex, nofollow, noarchive">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="referrer" content="no-referrer">
<title>__TITLE__</title>
<link rel="icon" type="image/svg+xml" href="__FAV__">
<!-- Google Analytics: counts visits to the password page -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-GV6E47H073"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-GV6E47H073');</script>
<style>
:root{--citrus:#FFCF5A;--violet:#B564F7;--white:#FBFAF7;--black:#212121;--grey2:#E8E6E1;--muted:#888;}
*{box-sizing:border-box;margin:0;padding:0;}
body{min-height:100svh;display:flex;align-items:center;justify-content:center;background:var(--white);font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;color:var(--black);padding:24px 16px;}
.box{width:min(420px,100%);}
.js-try .box{visibility:hidden;}
.eyebrow{font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:var(--muted);margin-bottom:14px;}
h1{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:38px;line-height:1.05;letter-spacing:-1px;}
h1 em{color:var(--violet);}
p{font-size:13.5px;font-weight:300;line-height:1.7;color:#666;margin-top:14px;}
form{margin-top:28px;display:flex;flex-direction:column;gap:10px;}
input{padding:13px 14px;border:1px solid var(--grey2);border-radius:10px;font-size:15px;background:white;outline:none;}
input:focus{border-color:var(--black);}
button{padding:13px 14px;border:none;border-radius:10px;background:var(--black);color:var(--white);font-size:14px;font-weight:600;cursor:pointer;}
button:disabled{opacity:.6;cursor:wait;}
#err{font-size:12.5px;color:#C0392B;min-height:18px;}
.logo{height:96px;width:auto;display:block;margin:-20px 0 12px -14px;}
.foot{margin-top:36px;font-size:11px;color:var(--muted);}
</style>
</head>
<body>
<div class="box">
  <img class="logo" src="__LOGO__" alt="PBV Agency">
  <div class="eyebrow">__EYEBROW__</div>
  <h1>__H1__</h1>
  <p>__INTRO__</p>
  <form id="f" autocomplete="off">
    <input id="pw" type="password" placeholder="Password" aria-label="Password" autofocus required>
    <button id="go" type="submit">__BUTTON__</button>
    <div id="err" role="alert"></div>
  </form>
  <div class="foot">PBV Agency &middot; pbvagency.com</div>
</div>
<script>
if(location.protocol==='http:'&&!/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname)){location.replace('https://'+location.host+location.pathname);}
const P=__PAYLOAD__;
const K='__KEY__', LABEL='__BUTTON__';
const d=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function unlock(pw){
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:d(P.s),iterations:P.n,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
  const buf=await crypto.subtle.decrypt({name:'AES-GCM',iv:d(P.i)},key,d(P.c));
  try{sessionStorage.setItem(K,pw);}catch(x){}
  const html=new TextDecoder().decode(buf);
  document.open();document.write(html);document.close();
}
document.getElementById('f').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=document.getElementById('go'),err=document.getElementById('err');
  if(!window.isSecureContext||!(window.crypto&&crypto.subtle)){
    err.textContent='This page needs a secure connection. Please open it with https:// at the start of the address.';
    return;
  }
  btn.disabled=true;btn.textContent='Opening...';err.textContent='';
  try{await unlock(document.getElementById('pw').value.trim());}
  catch(x){err.textContent='That password does not match. Please try again.';btn.disabled=false;btn.textContent=LABEL;}
});
/* Same tab, same client: the password is only asked once. */
(function(){let s=null;try{s=sessionStorage.getItem(K);}catch(x){}
  if(s&&window.isSecureContext&&window.crypto&&crypto.subtle){document.documentElement.classList.add('js-try');
    unlock(s).catch(()=>{try{sessionStorage.removeItem(K);}catch(x){}document.documentElement.classList.remove('js-try');});}})();
</script>
</body>
</html>
"""


def gate(payload, title, eyebrow, h1, intro, button, key):
    out = GATE
    for k, v in {"__TITLE__": H.escape(title), "__FAV__": FAV, "__LOGO__": LOGO, "__EYEBROW__": eyebrow,
                 "__H1__": h1, "__INTRO__": intro, "__BUTTON__": button, "__KEY__": key}.items():
        out = out.replace(k, v)
    out = out.replace("__PAYLOAD__", payload)
    assert "__" not in re.sub(r"const P=\{.*?\};", "", out, flags=re.S).replace("__proto__", ""), "placeholder left"
    return out


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").write(text)
    print("wrote", os.path.relpath(path, ROOT), f"{len(text)//1024} KB")


SPACE_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta name="robots" content="noindex, nofollow, noarchive">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="referrer" content="no-referrer">
<title>__TITLE__</title>
<link rel="icon" type="image/svg+xml" href="__FAV__">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-GV6E47H073"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-GV6E47H073');</script>
<style>
:root{--citrus:#FFCF5A;--violet:#B564F7;--human:#F2B9B4;--white:#FBFAF7;--black:#212121;--grey:#F4F3F0;--grey2:#E8E6E1;--muted:#888;}
*{box-sizing:border-box;margin:0;padding:0;}
body{min-height:100svh;background:var(--white);font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;color:var(--black);padding:48px 16px;display:flex;justify-content:center;}
.wrap{width:min(640px,100%);}
.logo{height:96px;width:auto;display:block;margin:-20px 0 12px -14px;}
.eyebrow{font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:var(--muted);margin-bottom:14px;}
h1{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:clamp(34px,6vw,46px);line-height:1.05;letter-spacing:-1px;}
h1 em{color:var(--violet);}
.intro{font-size:14px;font-weight:300;line-height:1.7;color:#666;margin-top:14px;max-width:520px;}
ul{list-style:none;margin-top:36px;display:flex;flex-direction:column;gap:12px;}
a.doc{display:flex;align-items:center;gap:18px;padding:20px 22px;background:white;border:1px solid var(--grey2);border-radius:14px;color:inherit;text-decoration:none;transition:border-color .2s,transform .2s;}
a.doc:hover{border-color:var(--black);transform:translateY(-1px);}
.bar{width:6px;align-self:stretch;border-radius:3px;background:var(--citrus);flex:none;}
li:nth-child(3n+2) .bar{background:var(--violet);} li:nth-child(3n+3) .bar{background:var(--human);}
.t{font-family:Georgia,"Times New Roman",serif;font-size:21px;line-height:1.2;}
.m{font-size:12.5px;color:var(--muted);margin-top:5px;}
.new{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;background:var(--citrus);padding:3px 7px;border-radius:4px;margin-left:8px;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;}
.go{margin-left:auto;font-size:20px;color:var(--muted);}
.note{font-size:12.5px;color:var(--muted);line-height:1.7;margin-top:28px;}
.note a{color:var(--black);}
.foot{margin-top:40px;font-size:11px;color:var(--muted);}
</style>
</head>
<body>
<div class="wrap">
  <img class="logo" src="__LOGO__" alt="PBV Agency">
  <div class="eyebrow">__EYEBROW__</div>
  <h1>Your <em>documents</em></h1>
  <p class="intro">__INTRO__</p>
  <ul>
__ITEMS__
  </ul>
  <p class="note">This page and every document on it are confidential and only open with your password. Questions about any of them: <a href="mailto:pauline@pbvagency.com">pauline@pbvagency.com</a></p>
  <div class="foot">PBV Agency &middot; <a href="https://pbvagency.com" style="color:inherit">pbvagency.com</a></div>
</div>
</body>
</html>
"""


def cmd_space(a):
    cfg = json.load(open(a.config))
    pw = read_pw(a.password_file)
    srcs = dict(s.split("=", 1) for s in (a.src or []))
    space = cfg["space"]
    assert re.fullmatch(r"[a-z0-9-]+", space), "space: lowercase letters, digits and dashes, e.g. les-elfes"
    base = os.path.join(ROOT, "clients", space)
    key = "pbv_" + space
    docs = cfg["documents"]
    for slug in srcs:
        assert any(doc["slug"] == slug for doc in docs), f"{slug} is not listed in {a.config}"
    for doc in docs:
        out = os.path.join(base, doc["slug"], "index.html")
        if doc["slug"] in srcs:
            text = open(srcs[doc["slug"]], encoding="utf-8").read()
            check_deck(text, doc["slug"])
            page = gate(encrypt(text, pw), f'{cfg["client"]} | {doc["title"]} | PBV Agency', f'{cfg["client"]} x PBV Agency',
                        doc["gate_h1"], "This document is confidential. Please enter the password shared with you by PBV Agency.",
                        doc.get("button", "Open the review"), key)
            write(out, page)
        else:
            assert os.path.exists(out), f"{doc['slug']}: no encrypted copy yet, pass --src {doc['slug']}=FILE"
    items = []
    for i, doc in enumerate(docs):
        new = '<span class="new">New</span>' if i == 0 and len(docs) > 1 else ""
        items.append(f'    <li><a class="doc" href="{doc["slug"]}/"><span class="bar"></span><span><div class="t">{doc["title"]}{new}</div>'
                     f'<div class="m">{doc["meta"]}</div></span><span class="go">&rarr;</span></a></li>')
    page = SPACE_PAGE
    for k, v in {"__TITLE__": H.escape(f'{cfg["client"]} | Your documents | PBV Agency'), "__FAV__": FAV, "__LOGO__": LOGO,
                 "__EYEBROW__": f'{cfg["client"]} x PBV Agency', "__INTRO__": cfg["intro"], "__ITEMS__": "\n".join(items)}.items():
        page = page.replace(k, v)
    write(os.path.join(base, "index.html"),
          gate(encrypt(page, pw), f'{cfg["client"]} | PBV Agency', f'{cfg["client"]} x PBV Agency', "Your <em>documents</em>",
               "Your private space with PBV Agency. Please enter the password shared with you by PBV Agency.", "Open", key))
    print(f"\nLink: https://clients.pbvagency.com/{space}/")


def cmd_proposal(a):
    pw = read_pw(a.password_file)
    assert re.fullmatch(r"[a-z0-9-]+", a.slug), "slug: lowercase letters, digits and dashes"
    text = open(a.src, encoding="utf-8").read()
    check_deck(text, a.slug)
    assert "edit-overlay" not in text, "strip the edit panel before publishing a proposal"
    who = f"{a.contact} and the {a.client} team" if a.contact else f"the {a.client} team"
    page = gate(encrypt(text, pw), f"PBV Agency x {a.client}", a.eyebrow, f"{H.escape(a.client)} <em>x</em> PBV Agency",
                f"This page is for {H.escape(who)}. Please enter the password from Pauline's email.", a.button, "pbv_" + a.slug)
    write(os.path.join(ROOT, "proposals", a.slug, "index.html"), page)
    print(f"\nLink: https://proposals.pbvagency.com/{a.slug}/")


p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
sub = p.add_subparsers(dest="cmd", required=True)
s = sub.add_parser("space"); s.add_argument("config"); s.add_argument("--password-file", required=True); s.add_argument("--src", action="append")
s.set_defaults(f=cmd_space)
s = sub.add_parser("proposal"); s.add_argument("src"); s.add_argument("slug"); s.add_argument("--client", required=True)
s.add_argument("--contact"); s.add_argument("--password-file", required=True)
s.add_argument("--eyebrow", default="Private proposal"); s.add_argument("--button", default="Open the proposal")
s.set_defaults(f=cmd_proposal)
s = sub.add_parser("newpassword"); s.set_defaults(f=lambda a: print(new_password()))
a = p.parse_args(); a.f(a)
