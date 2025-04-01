<script lang="ts">
	import { onMount } from 'svelte';

	export let audioData: Float32Array;

	let canvas: HTMLCanvasElement | null = null;
	let overlayCanvas: HTMLCanvasElement | null = null;

	onMount(() => {
		// Zoom and pan state
		let scale = 1.0;
		let offsetX = 0.0;
		let isDragging = false;
		let lastMouseX = 0;

		// WebGL Context Setup
		if (!canvas || !overlayCanvas) {
			console.error('Canvas elements not initialized');
			return;
		}
		const gl = canvas.getContext('webgl2');
		const ctx = overlayCanvas.getContext('2d');

		if (!gl) {
			console.error('WebGL2 not supported');
			return;
		}

		// Adjust canvas sizes to match
		overlayCanvas.width = canvas.width;
		overlayCanvas.height = canvas.height;

		// Updated vertex shader to support zoom and pan
		const vertexShaderSource = `#version 300 es
    in vec2 aVertexPosition;
    uniform float uScale;
    uniform float uOffsetX;
    out vec2 vTexCoord;
    void main() {
      // Apply zoom and pan transformation
      vec2 scaledPos = aVertexPosition;
      scaledPos.x = (scaledPos.x + uOffsetX) / uScale;
      gl_Position = vec4(scaledPos, 0.0, 1.0);
      vTexCoord = scaledPos * 0.5 + 0.5;
    }`;

		const fragmentShaderSource = `#version 300 es
    precision highp float;
    uniform float uAudioData[10];
    in vec2 vTexCoord;
    out vec4 outColor;
  
    void main() {
      // Interpolate through audio data
      float index = vTexCoord.x * 9.0;
      int lowerIndex = int(floor(index));
      int upperIndex = int(ceil(index));
      float fraction = fract(index);
  
      // Limit interpolation to valid indices
      lowerIndex = clamp(lowerIndex, 0, 9);
      upperIndex = clamp(upperIndex, 0, 9);
  
      // Linear interpolation between audio samples
      float interpolatedValue = mix(
        uAudioData[lowerIndex], 
        uAudioData[upperIndex], 
        fraction
      );
  
      // Create line representation of audio data
      float waveY = 0.5 + interpolatedValue * 0.4;
      float lineWidth = 0.005;
      float dist = abs(vTexCoord.y - waveY);
      float line = smoothstep(lineWidth, 0.0, dist);
  
      outColor = vec4(vec3(line), 1.0);
    }`;

		// Shader compilation function
		const createShader = (type: number, source: string) => {
			const shader = gl.createShader(type);
			if (!shader) return null;
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				console.error(gl.getShaderInfoLog(shader));
				return null;
			}
			return shader;
		};

		// Create and link program
		const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
		const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
		const program = gl.createProgram();
		if (!vertexShader || !fragmentShader) return;
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error('Link error:', gl.getProgramInfoLog(program));
			return;
		}

		// Vertex buffer
		const posBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

		// Rendering function
		const render = () => {
			if (!canvas || !gl || !program) return;
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.useProgram(program);

			// Set up vertex attributes
			const aPosition = gl.getAttribLocation(program, 'aVertexPosition');
			gl.enableVertexAttribArray(aPosition);
			gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

			// Set audio data uniform
			const audioDataLocation = gl.getUniformLocation(program, 'uAudioData');
			gl.uniform1fv(audioDataLocation, audioData);

			// Set zoom and pan uniforms
			const scaleLocation = gl.getUniformLocation(program, 'uScale');
			const offsetXLocation = gl.getUniformLocation(program, 'uOffsetX');
			gl.uniform1f(scaleLocation, scale);
			gl.uniform1f(offsetXLocation, offsetX);

			// Draw
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

			// Clear overlay canvas and draw labels
			if (!ctx || !overlayCanvas) return;
			ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
			drawLabels(ctx, audioData, scale, offsetX);
		};

		// Label drawing function
		const drawLabels = (
			ctx: CanvasRenderingContext2D,
			data: Float32Array,
			currentScale: number,
			currentOffsetX: number
		): void => {
			ctx.font = '12px Arial';
			ctx.fillStyle = 'white';
			ctx.textAlign = 'center';
			if (!overlayCanvas) return;
			// Calculate visible range
			const visibleStart = Math.max(
				0,
				Math.floor((-currentOffsetX / currentScale) * (data.length - 1))
			);
			const visibleEnd = Math.min(
				data.length - 1,
				Math.ceil(((1 - currentOffsetX) / currentScale) * (data.length - 1))
			);
			if (!overlayCanvas) return;
			// X-axis labels
			for (let i = visibleStart; i <= visibleEnd; i++) {
				const normalizedX = (i / (data.length - 1)) * currentScale - currentOffsetX;

				const x = normalizedX * overlayCanvas.width;
				ctx.fillText(`${i}`, x, overlayCanvas.height - 10);
			}

			// Y-axis labels
			ctx.textAlign = 'right';
			ctx.fillText('1.0', 40, 20);
			ctx.fillText('0.0', 40, overlayCanvas.height / 2);
			ctx.fillText('-1.0', 40, overlayCanvas.height - 20);

			// Draw grid lines
			ctx.strokeStyle = 'rgba(255,255,255,0.2)';
			ctx.beginPath();
			// Horizontal lines
			[0.25, 0.5, 0.75].forEach((ratio) => {
				if (!overlayCanvas) return;
				const y = ratio * overlayCanvas.height;
				ctx.moveTo(50, y);
				ctx.lineTo(overlayCanvas.width, y);
			});
			// Vertical lines
			for (let i = visibleStart; i <= visibleEnd; i++) {
				const normalizedX = (i / (data.length - 1)) * currentScale - currentOffsetX;
				const x = normalizedX * overlayCanvas.width;
				ctx.moveTo(x, 0);
				ctx.lineTo(x, overlayCanvas.height);
			}
			ctx.stroke();
		};

		// Mouse event handlers
		const handleWheel = (e: WheelEvent) => {
			e.preventDefault();
			if (!canvas) return;

			// Calculate mouse position relative to canvas
			const rect = canvas.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseNormalizedX = mouseX / canvas.width;

			// Adjust zoom
			const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
			const newScale = Math.max(1, Math.min(10, scale * zoomFactor));

			// Calculate new offset to keep mouse position consistent
			const scaleDiff = newScale - scale;
			offsetX += mouseNormalizedX * scaleDiff;

			scale = newScale;
			render();
		};

		const handleMouseDown = (e: MouseEvent) => {
			isDragging = true;
			lastMouseX = e.clientX;
		};

		const handleMouseMove = (e: MouseEvent) => {
			if (!isDragging || !canvas) return;

			const deltaX = e.clientX - lastMouseX;
			// Convert pixel movement to normalized coordinate movement
			offsetX += deltaX / (canvas.width * scale);

			lastMouseX = e.clientX;
			render();
		};

		const handleMouseUp = () => {
			isDragging = false;
		};

		// Add event listeners
		canvas.addEventListener('wheel', handleWheel);
		canvas.addEventListener('mousedown', handleMouseDown);
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);

		// Initial render
		render();

		// Cleanup function
		return () => {
			if (!canvas) return;
			gl.deleteProgram(program);
			gl.deleteShader(vertexShader);
			gl.deleteShader(fragmentShader);

			// Remove event listeners
			canvas.removeEventListener('wheel', handleWheel);
			canvas.removeEventListener('mousedown', handleMouseDown);
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};
	});
</script>

<div class="relative h-full w-full">
	<canvas
		bind:this={canvas}
		width="800"
		height="400"
		class="absolute top-0 left-0 h-full w-full cursor-move border border-gray-300"
	></canvas>
	<canvas
		bind:this={overlayCanvas}
		width="800"
		height="400"
		class="pointer-events-none absolute top-0 left-0 h-full w-full"
	></canvas>
</div>

<style>
	.relative {
		position: relative;
	}
	.absolute {
		position: absolute;
	}
	.top-0 {
		top: 0;
	}
	.left-0 {
		left: 0;
	}
	.w-full {
		width: 100%;
	}
	.h-full {
		height: 100%;
	}
	.border {
		border: 1px solid #d1d5db;
	}
	.pointer-events-none {
		pointer-events: none;
	}
	.cursor-move {
		cursor: move;
	}
</style>
