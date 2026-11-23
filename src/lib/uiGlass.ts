// TREND Glass — the storefront's visual layer.
//
// Only customer pages get it. Admin, ads, studio, bot and TikTok tools keep
// their own interfaces, and /moamalat-pay (the shared payment lightbox page used
// by the other apps) is left untouched on purpose.
export const GLASS_EXCLUDED_PREFIXES = [
  "/admin",
  "/ads",
  "/studio",
  "/bot",
  "/tiktok",
  "/facebook",
  "/subscriptions",
  "/moamalat-pay",
  "/r/",
];

export function isGlassPath(pathname: string): boolean {
  return !GLASS_EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : p + "/") || pathname.startsWith(p + "-"));
}

// Runs in <head> before paint: picks the theme, the glass layer and the motion
// preference so the first frame is already right (no flash).
export const preloadScript = `(function(){try{
var d=document.documentElement,p=location.pathname,x=${JSON.stringify(GLASS_EXCLUDED_PREFIXES)};
if(localStorage.getItem('theme')==='light'){d.classList.add('light');}
var g=!x.some(function(e){return p===e||p.indexOf(e.charAt(e.length-1)==='/'?e:e+'/')===0||p.indexOf(e+'-')===0;});
if(g){d.setAttribute('data-ui','glass');}
if(localStorage.getItem('ui-motion')==='auto'){d.classList.add('mo-auto');}
}catch(e){}})();`;
