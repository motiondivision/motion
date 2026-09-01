import "./style.css"

document.querySelector("#app").innerHTML = `
    <h1>Motion playground</h1>
    <p>GPU adapter previews</p>
    <div class="card">
        <a href="/three-animate.html">Three.js animate()</a>
        <a href="/three-effects.html">Three.js effects</a>
        <a href="/vgpu.html">vgpu uniforms</a>
    </div>
`
