/* EIS Digital Services — persistent page navigation */
(() => {
"use strict";
if(window.EISSpaNavigationLoaded)return;
window.EISSpaNavigationLoaded=true;
const ROUTES=new Set(["dashboard.html","marketplace.html","admin.html","support.html"]);
let busy=false,seq=0,currentRoute=location.pathname.split("/").pop();
function routeFor(value){const url=new URL(value,location.href),file=url.pathname.split("/").pop();return url.origin===location.origin&&ROUTES.has(file)?{file,url}:null;}
function active(file){document.querySelectorAll("a[href]").forEach(a=>{const r=routeFor(a.href);if(!r)return;const yes=r.file===file;a.classList.toggle("active",yes);a.classList.toggle("is-active",yes);if(yes)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});}
function syncHead(head){
document.title=head.querySelector("title")?.textContent||"EIS Digital Services";
document.head.querySelectorAll('meta[name="description"],meta[name="theme-color"]').forEach(n=>n.remove());
head.querySelectorAll('meta[name="description"],meta[name="theme-color"]').forEach(n=>document.head.append(n.cloneNode(true)));
const hrefs=[...head.querySelectorAll('link[rel="stylesheet"]')].map(n=>new URL(n.getAttribute("href"),location.href).href);
document.head.querySelectorAll('link[rel="stylesheet"]').forEach(n=>{if(!hrefs.includes(n.href)&&!n.dataset.keepSpa)n.remove();});
head.querySelectorAll('link[rel="stylesheet"]').forEach(s=>{const href=new URL(s.getAttribute("href"),location.href).href;if(![...document.head.querySelectorAll('link[rel="stylesheet"]')].some(n=>n.href===href)){const n=s.cloneNode(true);n.href=href;document.head.append(n);}});
document.head.querySelectorAll("style[data-page-style]").forEach(n=>n.remove());
head.querySelectorAll("style").forEach(s=>{const n=s.cloneNode(true);n.dataset.pageStyle="true";document.head.append(n);});
}
async function scripts(body,id){for(const old of body.querySelectorAll("script")){if(id!==seq)return;const s=document.createElement("script");for(const a of old.attributes){if(a.name==="src"){const u=new URL(a.value,location.href);u.searchParams.set("eis-nav",String(id));s.src=u.href;}else s.setAttribute(a.name,a.value);}if(!old.src)s.textContent=old.textContent;if(s.type==="module")await new Promise((ok,no)=>{s.onload=ok;s.onerror=()=>no(new Error("Page module failed to load"));document.body.append(s);});else document.body.append(s);}}
async function go(dest,opt={}){const r=routeFor(dest);if(!r||busy)return;const from=location.pathname.split("/").pop();if(r.file===currentRoute){if(opt.history!==false&&r.url.hash)location.hash=r.url.hash;return;}busy=true;const id=++seq;try{const res=await fetch(r.url.href,{credentials:"same-origin",headers:{"X-Requested-With":"EIS-SPA-Navigation"}});if(!res.ok)throw Error("Page request failed: "+res.status);const doc=new DOMParser().parseFromString(await res.text(),"text/html");if(!doc.body)throw Error("Invalid page response");const guard=await import(new URL("./route-guard.js",location.href).href);if(!(await guard.enforceProtectedRoute()))return;if(id!==seq)return;if(opt.history!==false)history.pushState({eisSpa:true},"",r.url.href);document.dispatchEvent(new CustomEvent("eis:before-page-change",{detail:{from,to:r.file}}));syncHead(doc.head);document.body.replaceWith(document.importNode(doc.body,true));currentRoute=r.file;active(r.file);scrollTo(0,0);await scripts(doc.body,id);document.dispatchEvent(new CustomEvent("eis:page-loaded",{detail:{route:r.file}}));}catch(e){console.error("EIS navigation failed; using full navigation.",e);if(opt.fallback!==false)location.assign(r.url.href);}finally{busy=false;}}
document.addEventListener("click",e=>{if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;const a=e.target.closest("a[href]");if(!a||(a.target&&a.target!=="_self")||a.hasAttribute("download")||a.getAttribute("rel")?.split(/\s+/).includes("external"))return;const r=routeFor(a.href);if(!r||r.file===location.pathname.split("/").pop())return;e.preventDefault();go(r.url.href);});
window.addEventListener("popstate",()=>{if(routeFor(location.href))go(location.href,{history:false});});
document.head.querySelectorAll("style").forEach(style=>style.dataset.pageStyle="true");
active(currentRoute);
})();