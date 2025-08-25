// chromaKeyFallback.js
// Lightweight re-export / minimal subset from earlier chromaKey example (WebGL only)

let gl, program, texture, positionBuffer;
let uniforms = {};
let cfg = {};
let usingVideoFrameCallback = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
let rafId;

export function initChromaKey({ videoEl, canvasEl, keyColor, similarity, smoothness, spill }) {
  cfg.video = videoEl;
  cfg.canvas = canvasEl;
  cfg.keyColor = keyColor;
  cfg.similarity = similarity;
  cfg.smoothness = smoothness;
  cfg.spill = spill;

  videoEl.addEventListener('loadedmetadata', () => setup());
}

function setup() {
  const { video, canvas } = cfg;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.classList.remove('hidden');
  video.classList.add('hidden');

  gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
  if (!gl) {
    console.warn('WebGL unavailable for chroma key fallback.');
    return;
  }
  const vertSrc = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position,0.0,1.0);
    }
  `;
  const fragSrc = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform vec3 u_keyColor;
    uniform float u_similarity;
    uniform float u_smoothness;
    uniform float u_spill;

    vec3 rgb2ycbcr(vec3 c){
      float y=0.299*c.r+0.587*c.g+0.114*c.b;
      float cb=-0.168736*c.r-0.331264*c.g+0.5*c.b+0.5;
      float cr=0.5*c.r-0.418688*c.g-0.081312*c.b+0.5;
      return vec3(y,cb,cr);
    }
    void main(){
      vec4 color=texture2D(u_tex,v_uv);
      vec3 keyYCC=rgb2ycbcr(u_keyColor);
      vec3 pixYCC=rgb2ycbcr(color.rgb);
      float dist=distance(pixYCC.yz,keyYCC.yz);
      float edge0=u_similarity - u_smoothness;
      float edge1=u_similarity + u_smoothness;
      float alpha=smoothstep(edge0, edge1, dist);
      float spillFactor=(1.0 - alpha) * u_spill;
      vec3 neutral=vec3((color.r+color.g+color.b)/3.0);
      vec3 finalRGB=mix(mix(color.rgb, neutral, spillFactor), color.rgb, alpha);
      gl_FragColor=vec4(finalRGB, alpha);
    }
  `;
  program = createProgram(gl, vertSrc, fragSrc);
  gl.useProgram(program);

  const aPosLoc = gl.getAttribLocation(program, 'a_position');
  positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,-1,  1,-1, -1, 1,
    -1, 1,  1,-1,  1, 1
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  uniforms.keyColor = gl.getUniformLocation(program, 'u_keyColor');
  uniforms.similarity = gl.getUniformLocation(program, 'u_similarity');
  uniforms.smoothness = gl.getUniformLocation(program, 'u_smoothness');
  uniforms.spill = gl.getUniformLocation(program, 'u_spill');
  uniforms.texture = gl.getUniformLocation(program, 'u_tex');

  gl.uniform3f(uniforms.keyColor, cfg.keyColor.r/255, cfg.keyColor.g/255, cfg.keyColor.b/255);

  function renderLoop() {
    if (video.readyState >= 2 && !video.paused && !video.ended) {
      renderFrame();
    }
    rafId = requestAnimationFrame(renderLoop);
  }

  if (usingVideoFrameCallback) {
    const cb = () => {
      renderFrame();
      video.requestVideoFrameCallback(cb);
    };
    video.requestVideoFrameCallback(cb);
  } else {
    rafId = requestAnimationFrame(renderLoop);
  }
}

function renderFrame() {
  const { video } = cfg;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  } catch {
    return;
  }
  gl.uniform1f(uniforms.similarity, cfg.similarity);
  gl.uniform1f(uniforms.smoothness, cfg.smoothness);
  gl.uniform1f(uniforms.spill, cfg.spill);
  gl.uniform1i(uniforms.texture, 0);
  gl.viewport(0,0,video.videoWidth, video.videoHeight);
  gl.clearColor(0,0,0,0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function createProgram(gl, vSrc, fSrc) {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vSrc);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(vs));
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fSrc);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(fs));
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

export function disposeChromaKey() {
  if (rafId) cancelAnimationFrame(rafId);
}