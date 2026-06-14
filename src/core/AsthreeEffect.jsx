import { forwardRef, useMemo, useEffect } from "react";
import { Effect, BlendFunction } from "postprocessing";
import {
    CanvasTexture,
    ClampToEdgeWrapping,
    Color,
    LinearFilter,
    Uniform,
    Vector2,
    Vector3,
} from "three";

const TERMINAL_SYMBOLS = [
    ".", ":", "-", "=", "+", "*", "#", "%", "@",
    "0", "O", "N", "M", "W", "B", "X",
];

function createGlyphTexture(characters, size = 64, font = "62px monospace") {
    if (characters.length === 0) return null;
    const count  = characters.length;
    const canvas = document.createElement("canvas");
    canvas.width  = size * count;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font          = font;
    ctx.textAlign     = "center";
    ctx.textBaseline  = "middle";
    for (let i = 0; i < count; i++) {
        ctx.fillText(characters[i], i * size + size / 2, size / 2);
    }
    const texture        = new CanvasTexture(canvas);
    texture.needsUpdate  = true;
    texture.minFilter    = LinearFilter;
    texture.magFilter    = LinearFilter;
    texture.wrapS        = ClampToEdgeWrapping;
    texture.wrapT        = ClampToEdgeWrapping;
    return texture;
}

const fragmentShader = `
uniform float cellSize;
uniform bool invert;
uniform bool colorMode;
uniform int asciiStyle;
uniform float time;
uniform vec2 resolution;
uniform vec2 mousePos;
uniform float scanlineIntensity;
uniform float scanlineCount;
uniform float targetFPS;
uniform float jitterIntensity;
uniform float jitterSpeed;
uniform bool mouseGlowEnabled;
uniform float mouseGlowRadius;
uniform float mouseGlowIntensity;
uniform float vignetteIntensity;
uniform float vignetteRadius;
uniform int colorPalette;
uniform float curvature;
uniform float aberrationStrength;
uniform float noiseIntensity;
uniform float noiseScale;
uniform float noiseSpeed;
uniform float waveAmplitude;
uniform float waveFrequency;
uniform float waveSpeed;
uniform float glitchIntensity;
uniform float glitchFrequency;
uniform float brightnessAdjust;
uniform float contrastAdjust;
uniform sampler2D glyphAtlas;
uniform float glyphTiles;
uniform bool useGlyphAtlas;
uniform bool volumeShading;
uniform float shadingIntensity;
uniform bool useTintColor;
uniform vec3 tintColor;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

vec3 applyColorPalette(vec3 color, int palette) {
  if (palette == 1) {
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    return vec3(0.1, lum * 0.9, 0.1);
  } else if (palette == 2) {
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    return vec3(lum * 1.0, lum * 0.6, lum * 0.2);
  } else if (palette == 3) {
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    return vec3(0.0, lum * 0.8, lum);
  } else if (palette == 4) {
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    return vec3(0.1, 0.2, lum);
  }
  return color;
}

float getChar(float brightness, vec2 p, int style) {
  if (brightness < 0.01) return 0.0;
  vec2 grid = floor(p * 4.0);
  float val = 0.0;
  if (style == 0) {
    float dotP   = (grid.x == 1.0 && grid.y == 1.0) ? 1.0 : 0.0;
    float block2 = (grid.x == 1.0 || grid.x == 2.0) && (grid.y == 1.0 || grid.y == 2.0) ? 1.0 : 0.0;
    float barH   = (grid.y == 1.0 || grid.y == 2.0) ? 1.0 : 0.0;
    float barH2  = (grid.y == 0.0 || grid.y == 3.0) ? 1.0 : (grid.y == 1.0 || grid.y == 2.0) ? 0.5 : 0.0;
    float edge   = (grid.x == 0.0 || grid.x == 2.0 || grid.y == 0.0 || grid.y == 2.0) ? 1.0 : 0.3;
    float t0 = 1.0 - smoothstep(0.0, 0.15, brightness);
    float t1 = smoothstep(0.08, 0.22, brightness) * (1.0 - smoothstep(0.22, 0.35, brightness));
    float t2 = smoothstep(0.20, 0.38, brightness) * (1.0 - smoothstep(0.38, 0.50, brightness));
    float t3 = smoothstep(0.35, 0.52, brightness) * (1.0 - smoothstep(0.52, 0.65, brightness));
    float t4 = smoothstep(0.50, 0.70, brightness) * (1.0 - smoothstep(0.70, 0.82, brightness));
    float t5 = smoothstep(0.68, 1.0, brightness);
    val = dotP * t0 * 0.5 + block2 * t1 + barH * t2 + barH2 * t3 + edge * t4 + t5;
    val = clamp(val, 0.0, 1.0);
  }
  return val;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 workUV = uv;

  if (curvature > 0.0) {
    vec2 centered = workUV * 2.0 - 1.0;
    centered *= 1.0 + curvature * dot(centered, centered);
    workUV = centered * 0.5 + 0.5;
    if (workUV.x < 0.0 || workUV.x > 1.0 || workUV.y < 0.0 || workUV.y > 1.0) {
      outputColor = vec4(0.0);
      return;
    }
  }

  if (waveAmplitude > 0.0) {
    workUV.x += sin(workUV.y * waveFrequency + time * waveSpeed) * waveAmplitude;
    workUV.y += cos(workUV.x * waveFrequency + time * waveSpeed) * waveAmplitude;
  }

  vec4 sampledColor;
  if (aberrationStrength > 0.0) {
    float offset = aberrationStrength;
    float r = texture(inputBuffer, workUV + vec2(offset, 0.0)).r;
    float g = texture(inputBuffer, workUV).g;
    float b = texture(inputBuffer, workUV - vec2(offset, 0.0)).b;
    sampledColor = vec4(r, g, b, 1.0);
  } else {
    sampledColor = texture(inputBuffer, workUV);
  }

  sampledColor.rgb = (sampledColor.rgb - 0.5) * contrastAdjust + 0.5 + brightnessAdjust;

  if (noiseIntensity > 0.0) {
    float noiseVal = noise(workUV * noiseScale + time * noiseSpeed);
    sampledColor.rgb += (noiseVal - 0.5) * noiseIntensity;
  }

  vec2 cellCount = resolution / cellSize;
  vec2 cellCoord = floor(uv * cellCount);

  if (jitterIntensity > 0.0) {
    float jitterTime = time * jitterSpeed;
    float jitterX = (random(vec2(cellCoord.y, floor(jitterTime))) - 0.5) * jitterIntensity * 2.0;
    float jitterY = (random(vec2(cellCoord.x, floor(jitterTime + 1000.0))) - 0.5) * jitterIntensity * 2.0;
    cellCoord += vec2(jitterX, jitterY);
  }

  if (glitchIntensity > 0.0 && glitchFrequency > 0.0) {
    float glitchTime = floor(time * glitchFrequency);
    float glitchRand = random(vec2(glitchTime, cellCoord.y));
    if (glitchRand < glitchIntensity) {
      float shift = (random(vec2(glitchTime + 1.0, cellCoord.y)) - 0.5) * 20.0;
      cellCoord.x += shift;
    }
  }

  vec2 cellUV    = (cellCoord + 0.5) / cellCount;
  vec4 cellColor = texture(inputBuffer, cellUV);
  float rawLuminance = dot(cellColor.rgb, vec3(0.299, 0.587, 0.114));
  cellColor.rgb = (cellColor.rgb - 0.5) * contrastAdjust + 0.5 + brightnessAdjust;
  float brightness = dot(cellColor.rgb, vec3(0.299, 0.587, 0.114));

  if (invert) brightness = 1.0 - brightness;

  float brightnessForGlyph = brightness;
  if (volumeShading) {
    brightnessForGlyph = (brightness - 0.5) * (1.0 + shadingIntensity) + 0.5;
    brightnessForGlyph = clamp(brightnessForGlyph, 0.0, 1.0);
  }

  float emptyThreshold = volumeShading ? 0.04 : 0.14;
  vec2  localUV        = fract(uv * cellCount);
  float charValue;
  bool  isBackground   = rawLuminance < 0.06;

  if (isBackground || brightness < emptyThreshold) {
    charValue = 0.0;
  } else if (useGlyphAtlas && glyphTiles > 0.0) {
    float tile  = floor(brightnessForGlyph * glyphTiles);
    tile        = clamp(tile, 0.0, glyphTiles - 1.0);
    float inset = 0.02;
    vec2 inner  = vec2(inset + localUV.x * (1.0 - 2.0 * inset), inset + localUV.y * (1.0 - 2.0 * inset));
    vec2 glyphUV = vec2((tile + inner.x) / glyphTiles, inner.y);
    charValue = texture(glyphAtlas, glyphUV).r;
  } else {
    charValue = getChar(brightnessForGlyph, localUV, asciiStyle);
  }

  vec3 finalColor;
  if (colorMode) {
    if (useTintColor) {
      finalColor = tintColor * charValue;
    } else {
      finalColor = cellColor.rgb * charValue;
    }
  } else {
    finalColor = vec3(brightness * charValue);
  }

  finalColor = applyColorPalette(finalColor, colorPalette);

  if (mouseGlowEnabled) {
    vec2  pixelPos = uv * resolution;
    float dist     = length(pixelPos - mousePos);
    float glow     = exp(-dist / mouseGlowRadius) * mouseGlowIntensity;
    finalColor += glow;
  }

  if (scanlineIntensity > 0.0) {
    float scanline = sin(uv.y * scanlineCount * 3.14159) * 0.5 + 0.5;
    finalColor *= 1.0 - (scanline * scanlineIntensity);
  }

  if (vignetteIntensity > 0.0) {
    vec2  centered = uv * 2.0 - 1.0;
    float vignette = 1.0 - dot(centered, centered) / vignetteRadius;
    finalColor    *= mix(1.0, vignette, vignetteIntensity);
  }

  outputColor = vec4(finalColor, charValue);
}
`;

// Variables de módulo para actualizar desde el render loop sin recrear el efecto
let _time             = 0;
let _deltaAccumulator = 0;
let _cellSize         = 9;
let _invert           = true;
let _colorMode        = true;
let _asciiStyle       = 0;
let _resolution       = new Vector2(1920, 1080);
let _mousePos         = new Vector2(0, 0);

class AsthreeEffectImpl extends Effect {
    constructor(options = {}) {
        const {
            cellSize       = 9,
            invert         = true,
            color          = true,
            style          = 0,
            resolution     = new Vector2(1920, 1080),
            mousePos       = new Vector2(0, 0),
            postfx         = {},
            glyphAtlas     = null,
            glyphTiles     = 0,
            volumeShading  = true,
            shadingIntensity = 0.5,
            tintColor      = null,
        } = options;

        super("AsthreeEffect", fragmentShader, {
            blendFunction: BlendFunction.NORMAL,
            uniforms: new Map([
                ["cellSize",          new Uniform(cellSize)],
                ["invert",            new Uniform(invert)],
                ["colorMode",         new Uniform(color)],
                ["asciiStyle",        new Uniform(style)],
                ["time",              new Uniform(0)],
                ["resolution",        new Uniform(resolution)],
                ["mousePos",          new Uniform(mousePos)],
                ["glyphAtlas",        new Uniform(glyphAtlas)],
                ["glyphTiles",        new Uniform(glyphTiles)],
                ["useGlyphAtlas",     new Uniform(!!glyphAtlas)],
                ["volumeShading",     new Uniform(volumeShading)],
                ["shadingIntensity",  new Uniform(shadingIntensity)],
                ["useTintColor",      new Uniform(!!tintColor)],
                ["tintColor",         new Uniform(tintColor || new Vector3(1, 1, 1))],
                ["scanlineIntensity", new Uniform(postfx.scanlineIntensity  || 0)],
                ["scanlineCount",     new Uniform(postfx.scanlineCount      || 200)],
                ["targetFPS",         new Uniform(postfx.targetFPS          || 0)],
                ["jitterIntensity",   new Uniform(postfx.jitterIntensity    || 0)],
                ["jitterSpeed",       new Uniform(postfx.jitterSpeed        || 1)],
                ["mouseGlowEnabled",  new Uniform(postfx.mouseGlowEnabled   || false)],
                ["mouseGlowRadius",   new Uniform(postfx.mouseGlowRadius    || 200)],
                ["mouseGlowIntensity",new Uniform(postfx.mouseGlowIntensity || 1.5)],
                ["vignetteIntensity", new Uniform(postfx.vignetteIntensity  || 0)],
                ["vignetteRadius",    new Uniform(postfx.vignetteRadius     || 0.8)],
                ["colorPalette",      new Uniform(postfx.colorPalette       || 0)],
                ["curvature",         new Uniform(postfx.curvature          || 0)],
                ["aberrationStrength",new Uniform(postfx.aberrationStrength || 0)],
                ["noiseIntensity",    new Uniform(postfx.noiseIntensity     || 0)],
                ["noiseScale",        new Uniform(postfx.noiseScale         || 1)],
                ["noiseSpeed",        new Uniform(postfx.noiseSpeed         || 1)],
                ["waveAmplitude",     new Uniform(postfx.waveAmplitude      || 0)],
                ["waveFrequency",     new Uniform(postfx.waveFrequency      || 10)],
                ["waveSpeed",         new Uniform(postfx.waveSpeed          || 1)],
                ["glitchIntensity",   new Uniform(postfx.glitchIntensity    || 0)],
                ["glitchFrequency",   new Uniform(postfx.glitchFrequency    || 0)],
                ["brightnessAdjust",  new Uniform(postfx.brightnessAdjust   || 0)],
                ["contrastAdjust",    new Uniform(postfx.contrastAdjust     || 1)],
            ]),
        });

        _cellSize   = cellSize;
        _invert     = invert;
        _colorMode  = color;
        _asciiStyle = style;
        _resolution = resolution;
        _mousePos   = mousePos;
    }

    update(renderer, inputBuffer, deltaTime) {
        const context = renderer.getContext();
        if (!context || context.isContextLost?.()) return;

        const targetFPS = this.uniforms.get("targetFPS").value;
        const dt        = deltaTime ?? 0;

        if (targetFPS > 0) {
            const frameDuration = 1 / targetFPS;
            _deltaAccumulator += dt;
            if (_deltaAccumulator >= frameDuration) {
                _time             += frameDuration;
                _deltaAccumulator  = _deltaAccumulator % frameDuration;
            }
        } else {
            _time += dt;
        }

        this.uniforms.get("time").value       = _time;
        this.uniforms.get("cellSize").value   = _cellSize;
        this.uniforms.get("invert").value     = _invert;
        this.uniforms.get("colorMode").value  = _colorMode;
        this.uniforms.get("asciiStyle").value = _asciiStyle;
        this.uniforms.get("resolution").value = _resolution;
        this.uniforms.get("mousePos").value   = _mousePos;
    }
}

export const AsthreeEffect = forwardRef(({ settings, resolution = new Vector2(1920, 1080), mousePos = new Vector2(0, 0), characterSet = "terminal" }, ref) => {
    const { ascii, postfx } = settings;

    const dpr              = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    const adjustedCellSize = Math.max(5, ascii.cellSize * dpr);
    const styleMap         = { standard: 0, dense: 1, minimal: 2, blocks: 3 };
    const styleNum         = styleMap[ascii.style] || 0;

    const tintColorVec = useMemo(() => {
        if (!ascii.tintColor) return null;
        const c = new Color(ascii.tintColor);
        return new Vector3(c.r, c.g, c.b);
    }, [ascii.tintColor]);

    const glyphTexture = useMemo(() => {
        if (characterSet == null) return null;
        const chars =
            characterSet === "terminal"
                ? TERMINAL_SYMBOLS
                : Array.isArray(characterSet)
                  ? characterSet
                  : null;
        return chars ? createGlyphTexture(chars) : null;
    }, [characterSet]);

    // Actualizar las variables de módulo en cada render
    _cellSize   = adjustedCellSize;
    _invert     = ascii.invert;
    _colorMode  = ascii.color;
    _asciiStyle = styleNum;
    _resolution = resolution;
    _mousePos   = mousePos;

    const effect = useMemo(
        () =>
            new AsthreeEffectImpl({
                cellSize:        adjustedCellSize,
                invert:          ascii.invert,
                color:           ascii.color,
                style:           styleNum,
                postfx,
                resolution,
                glyphAtlas:      glyphTexture,
                glyphTiles:      glyphTexture
                    ? characterSet === "terminal"
                        ? TERMINAL_SYMBOLS.length
                        : Array.isArray(characterSet) ? characterSet.length : 0
                    : 0,
                volumeShading:   ascii.volumeShading,
                shadingIntensity: ascii.shadingIntensity,
                tintColor:       tintColorVec,
                mousePos,
            }),
        [
            adjustedCellSize, ascii.invert, ascii.color, styleNum, postfx,
            resolution, glyphTexture, characterSet,
            ascii.volumeShading, ascii.shadingIntensity, tintColorVec, mousePos,
        ],
    );

    useEffect(() => {
        return () => { if (glyphTexture) glyphTexture.dispose(); };
    }, [glyphTexture]);

    return <primitive ref={ref} object={effect} dispose={null} />;
});

AsthreeEffect.displayName = "AsthreeEffect";