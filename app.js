import { h, render } from "https://esm.sh/preact@10.22.0";
import { useState } from "https://esm.sh/preact@10.22.0/hooks";
import htm from "https://esm.sh/htm@3.1.1";
const html = htm.bind(h);

function App(){
  return html`<div class="container"><h1>v1.0-rc2 Demo</h1><p>App cargada.</p></div>`;
}
render(html`<${App}/>`, document.getElementById("app"));
