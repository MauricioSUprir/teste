"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[100],{1118:(e,t,i)=>{i.d(t,{C:()=>l});var r=i(773),a=i(5476),s=i(4530);let o={name:"LuminosityHighPassShader",shaderID:"luminosityHighPass",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new r.Q1f(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class l extends a.o{constructor(e,t,i,l){super(),this.strength=void 0!==t?t:1,this.radius=i,this.threshold=l,this.resolution=void 0!==e?new r.I9Y(e.x,e.y):new r.I9Y(256,256),this.clearColor=new r.Q1f(0,0,0),this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let n=Math.round(this.resolution.x/2),h=Math.round(this.resolution.y/2);this.renderTargetBright=new r.nWS(n,h,{type:r.ix0}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let e=0;e<this.nMips;e++){let t=new r.nWS(n,h,{type:r.ix0});t.texture.name="UnrealBloomPass.h"+e,t.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(t);let i=new r.nWS(n,h,{type:r.ix0});i.texture.name="UnrealBloomPass.v"+e,i.texture.generateMipmaps=!1,this.renderTargetsVertical.push(i),n=Math.round(n/2),h=Math.round(h/2)}this.highPassUniforms=r.LlO.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=l,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new r.BKk({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let u=[3,5,7,9,11];n=Math.round(this.resolution.x/2),h=Math.round(this.resolution.y/2);for(let e=0;e<this.nMips;e++)this.separableBlurMaterials.push(this.getSeperableBlurMaterial(u[e])),this.separableBlurMaterials[e].uniforms.invSize.value=new r.I9Y(1/n,1/h),n=Math.round(n/2),h=Math.round(h/2);this.compositeMaterial=this.getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1,this.compositeMaterial.uniforms.bloomFactors.value=[1,.8,.6,.4,.2],this.bloomTintColors=[new r.Pq0(1,1,1),new r.Pq0(1,1,1),new r.Pq0(1,1,1),new r.Pq0(1,1,1),new r.Pq0(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors;let d=s.Z;this.copyUniforms=r.LlO.clone(d.uniforms),this.blendMaterial=new r.BKk({uniforms:this.copyUniforms,vertexShader:d.vertexShader,fragmentShader:d.fragmentShader,blending:r.EZo,depthTest:!1,depthWrite:!1,transparent:!0}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new r.Q1f,this.oldClearAlpha=1,this.basic=new r.V9B,this.fsQuad=new a.F(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this.basic.dispose(),this.fsQuad.dispose()}setSize(e,t){let i=Math.round(e/2),a=Math.round(t/2);this.renderTargetBright.setSize(i,a);for(let e=0;e<this.nMips;e++)this.renderTargetsHorizontal[e].setSize(i,a),this.renderTargetsVertical[e].setSize(i,a),this.separableBlurMaterials[e].uniforms.invSize.value=new r.I9Y(1/i,1/a),i=Math.round(i/2),a=Math.round(a/2)}render(e,t,i,r,a){e.getClearColor(this._oldClearColor),this.oldClearAlpha=e.getClearAlpha();let s=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),a&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this.fsQuad.material=this.basic,this.basic.map=i.texture,e.setRenderTarget(null),e.clear(),this.fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=i.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this.fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this.fsQuad.render(e);let o=this.renderTargetBright;for(let t=0;t<this.nMips;t++)this.fsQuad.material=this.separableBlurMaterials[t],this.separableBlurMaterials[t].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[t].uniforms.direction.value=l.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[t]),e.clear(),this.fsQuad.render(e),this.separableBlurMaterials[t].uniforms.colorTexture.value=this.renderTargetsHorizontal[t].texture,this.separableBlurMaterials[t].uniforms.direction.value=l.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[t]),e.clear(),this.fsQuad.render(e),o=this.renderTargetsVertical[t];this.fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this.fsQuad.render(e),this.fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?e.setRenderTarget(null):e.setRenderTarget(i),this.fsQuad.render(e),e.setClearColor(this._oldClearColor,this.oldClearAlpha),e.autoClear=s}getSeperableBlurMaterial(e){let t=[];for(let i=0;i<e;i++)t.push(.39894*Math.exp(-.5*i*i/(e*e))/e);return new r.BKk({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new r.I9Y(.5,.5)},direction:{value:new r.I9Y(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}getCompositeMaterial(e){return new r.BKk({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}}l.BlurDirectionX=new r.I9Y(1,0),l.BlurDirectionY=new r.I9Y(0,1)},2409:(e,t,i)=>{i.d(t,{s:()=>h});var r=i(773),a=i(4530),s=i(5476);class o extends s.o{constructor(e,t){super(),this.textureID=void 0!==t?t:"tDiffuse",e instanceof r.BKk?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=r.LlO.clone(e.uniforms),this.material=new r.BKk({name:void 0!==e.name?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this.fsQuad=new s.F(this.material)}render(e,t,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this.fsQuad.material=this.material,this.renderToScreen?e.setRenderTarget(null):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil)),this.fsQuad.render(e)}dispose(){this.material.dispose(),this.fsQuad.dispose()}}class l extends s.o{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,i){let r,a,s=e.getContext(),o=e.state;o.buffers.color.setMask(!1),o.buffers.depth.setMask(!1),o.buffers.color.setLocked(!0),o.buffers.depth.setLocked(!0),this.inverse?(r=0,a=1):(r=1,a=0),o.buffers.stencil.setTest(!0),o.buffers.stencil.setOp(s.REPLACE,s.REPLACE,s.REPLACE),o.buffers.stencil.setFunc(s.ALWAYS,r,0xffffffff),o.buffers.stencil.setClear(a),o.buffers.stencil.setLocked(!0),e.setRenderTarget(i),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),o.buffers.color.setLocked(!1),o.buffers.depth.setLocked(!1),o.buffers.color.setMask(!0),o.buffers.depth.setMask(!0),o.buffers.stencil.setLocked(!1),o.buffers.stencil.setFunc(s.EQUAL,1,0xffffffff),o.buffers.stencil.setOp(s.KEEP,s.KEEP,s.KEEP),o.buffers.stencil.setLocked(!0)}}class n extends s.o{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class h{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),void 0===t){let i=e.getSize(new r.I9Y);this._width=i.width,this._height=i.height,(t=new r.nWS(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:r.ix0})).texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new o(a.Z),this.copyPass.material.blending=r.XIg,this.clock=new r.zD7}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);-1!==t&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){void 0===e&&(e=this.clock.getDelta());let t=this.renderer.getRenderTarget(),i=!1;for(let t=0,r=this.passes.length;t<r;t++){let r=this.passes[t];if(!1!==r.enabled){if(r.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(t),r.render(this.renderer,this.writeBuffer,this.readBuffer,e,i),r.needsSwap){if(i){let t=this.renderer.getContext(),i=this.renderer.state.buffers.stencil;i.setFunc(t.NOTEQUAL,1,0xffffffff),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),i.setFunc(t.EQUAL,1,0xffffffff)}this.swapBuffers()}void 0!==l&&(r instanceof l?i=!0:r instanceof n&&(i=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(void 0===e){let t=this.renderer.getSize(new r.I9Y);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,(e=this.renderTarget1.clone()).setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let i=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(i,r),this.renderTarget2.setSize(i,r);for(let e=0;e<this.passes.length;e++)this.passes[e].setSize(i,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}},3495:(e,t,i)=>{i.d(t,{X:()=>o});var r=i(773),a=i(5476);let s={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`
	
		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class o extends a.o{constructor(){super(),this.uniforms=r.LlO.clone(s.uniforms),this.material=new r.D$Q({name:s.name,uniforms:this.uniforms,vertexShader:s.vertexShader,fragmentShader:s.fragmentShader}),this.fsQuad=new a.F(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,i){this.uniforms.tDiffuse.value=i.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},r.ppV.getTransfer(this._outputColorSpace)===r.KLL&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===r.kyO?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===r.Mjd?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===r.nNL?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===r.FV?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===r.LAk?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===r.aJ8&&(this.material.defines.NEUTRAL_TONE_MAPPING=""),this.material.needsUpdate=!0),!0===this.renderToScreen?e.setRenderTarget(null):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil)),this.fsQuad.render(e)}dispose(){this.material.dispose(),this.fsQuad.dispose()}}},4530:(e,t,i)=>{i.d(t,{Z:()=>r});let r={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`}},5476:(e,t,i)=>{i.d(t,{F:()=>n,o:()=>a});var r=i(773);class a{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}let s=new r.qUd(-1,1,1,-1,0,1);class o extends r.LoY{constructor(){super(),this.setAttribute("position",new r.qtW([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new r.qtW([0,2,0,0,2,0],2))}}let l=new o;class n{constructor(e){this._mesh=new r.eaF(l,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,s)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}},5872:(e,t,i)=>{i.d(t,{l:()=>a});var r=i(773);class a extends r.Z58{constructor(){super();let e=new r.iNn;e.deleteAttribute("uv");let t=new r._4j({side:r.hsX}),i=new r._4j,a=new r.HiM(0xffffff,900,28,2);a.position.set(.418,16.199,.3),this.add(a);let o=new r.eaF(e,t);o.position.set(-.757,13.219,.717),o.scale.set(31.713,28.305,28.591),this.add(o);let l=new r.eaF(e,i);l.position.set(-10.906,2.009,1.846),l.rotation.set(0,-.195,0),l.scale.set(2.328,7.905,4.651),this.add(l);let n=new r.eaF(e,i);n.position.set(-5.607,-.754,-.758),n.rotation.set(0,.994,0),n.scale.set(1.97,1.534,3.955),this.add(n);let h=new r.eaF(e,i);h.position.set(6.167,.857,7.803),h.rotation.set(0,.561,0),h.scale.set(3.927,6.285,3.687),this.add(h);let u=new r.eaF(e,i);u.position.set(-2.017,.018,6.124),u.rotation.set(0,.333,0),u.scale.set(2.002,4.566,2.064),this.add(u);let d=new r.eaF(e,i);d.position.set(2.291,-.756,-2.621),d.rotation.set(0,-.286,0),d.scale.set(1.546,1.552,1.496),this.add(d);let c=new r.eaF(e,i);c.position.set(-2.193,-.369,-5.547),c.rotation.set(0,.516,0),c.scale.set(3.875,3.487,2.986),this.add(c);let f=new r.eaF(e,s(50));f.position.set(-16.116,14.37,8.208),f.scale.set(.1,2.428,2.739),this.add(f);let m=new r.eaF(e,s(50));m.position.set(-16.109,18.021,-8.207),m.scale.set(.1,2.425,2.751),this.add(m);let p=new r.eaF(e,s(17));p.position.set(14.904,12.198,-1.832),p.scale.set(.15,4.265,6.331),this.add(p);let v=new r.eaF(e,s(43));v.position.set(-.462,8.89,14.52),v.scale.set(4.38,5.441,.088),this.add(v);let g=new r.eaF(e,s(20));g.position.set(3.235,11.486,-12.541),g.scale.set(2.5,2,.1),this.add(g);let x=new r.eaF(e,s(100));x.position.set(0,20,0),x.scale.set(1,.1,1),this.add(x)}dispose(){let e=new Set;for(let t of(this.traverse(t=>{t.isMesh&&(e.add(t.geometry),e.add(t.material))}),e))t.dispose()}}function s(e){let t=new r.V9B;return t.color.setScalar(e),t}},6282:(e,t,i)=>{i.d(t,{pP:()=>a});var r=i(773);function a(e,t=!1){let i=null!==e[0].index,o=new Set(Object.keys(e[0].attributes)),l=new Set(Object.keys(e[0].morphAttributes)),n={},h={},u=e[0].morphTargetsRelative,d=new r.LoY,c=0;for(let r=0;r<e.length;++r){let a=e[r],s=0;if(i!==(null!==a.index))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+r+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let e in a.attributes){if(!o.has(e))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+r+'. All geometries must have compatible attributes; make sure "'+e+'" attribute exists among all geometries, or in none of them.'),null;void 0===n[e]&&(n[e]=[]),n[e].push(a.attributes[e]),s++}if(s!==o.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+r+". Make sure all geometries have the same number of attributes."),null;if(u!==a.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+r+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let e in a.morphAttributes){if(!l.has(e))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+r+".  .morphAttributes must be consistent throughout all geometries."),null;void 0===h[e]&&(h[e]=[]),h[e].push(a.morphAttributes[e])}if(t){let e;if(i)e=a.index.count;else{if(void 0===a.attributes.position)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+r+". The geometry must have either an index or a position attribute"),null;e=a.attributes.position.count}d.addGroup(c,e,r),c+=e}}if(i){let t=0,i=[];for(let r=0;r<e.length;++r){let a=e[r].index;for(let e=0;e<a.count;++e)i.push(a.getX(e)+t);t+=e[r].attributes.position.count}d.setIndex(i)}for(let e in n){let t=s(n[e]);if(!t)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+e+" attribute."),null;d.setAttribute(e,t)}for(let e in h){let t=h[e][0].length;if(0===t)break;d.morphAttributes=d.morphAttributes||{},d.morphAttributes[e]=[];for(let i=0;i<t;++i){let t=[];for(let r=0;r<h[e].length;++r)t.push(h[e][r][i]);let r=s(t);if(!r)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+e+" morphAttribute."),null;d.morphAttributes[e].push(r)}}return d}function s(e){let t,i,a,s=-1,o=0;for(let r=0;r<e.length;++r){let l=e[r];if(void 0===t&&(t=l.array.constructor),t!==l.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(void 0===i&&(i=l.itemSize),i!==l.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(void 0===a&&(a=l.normalized),a!==l.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(-1===s&&(s=l.gpuType),s!==l.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;o+=l.count*i}let l=new t(o),n=new r.THS(l,i,a),h=0;for(let t=0;t<e.length;++t){let r=e[t];if(r.isInterleavedBufferAttribute){let e=h/i;for(let t=0,a=r.count;t<a;t++)for(let a=0;a<i;a++){let i=r.getComponent(t,a);n.setComponent(t+e,a,i)}}else l.set(r.array,h);h+=r.count*i}return void 0!==s&&(n.gpuType=s),n}},6448:(e,t,i)=>{i.d(t,{A:()=>s});var r=i(773),a=i(5476);class s extends a.o{constructor(e,t,i=null,a=null,s=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=i,this.clearColor=a,this.clearAlpha=s,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new r.Q1f}render(e,t,i){let r,a,s=e.autoClear;e.autoClear=!1,null!==this.overrideMaterial&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),null!==this.clearColor&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),null!==this.clearAlpha&&(r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),!0==this.clearDepth&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:i),!0===this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),null!==this.clearColor&&e.setClearColor(this._oldClearColor),null!==this.clearAlpha&&e.setClearAlpha(r),null!==this.overrideMaterial&&(this.scene.overrideMaterial=a),e.autoClear=s}}},8519:(e,t,i)=>{i.d(t,{F:()=>c});var r=i(773),a=i(5476);let s={name:"GTAOShader",defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:"x",SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new r.I9Y},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new r.kn4},cameraProjectionMatrixInverse:{value:new r.kn4},cameraWorldMatrix:{value:new r.kn4},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new r.Pq0(-1,-1,-1)},sceneBoxMax:{value:new r.Pq0(1,1,1)}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		varying vec2 vUv;
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraProjectionMatrixInverse;		
		uniform mat4 cameraWorldMatrix;
		uniform float radius;
		uniform float distanceExponent;
		uniform float thickness;
		uniform float distanceFallOff;
		uniform float scale;
		#if SCENE_CLIP_BOX == 1
			uniform vec3 sceneBoxMin;
			uniform vec3 sceneBoxMax;
		#endif
		
		#include <common>
		#include <packing>

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(vec3(ao), 1.)
		#endif

		vec3 getViewPosition(const in vec2 screenPosition, const in float depth) {
			vec4 clipSpacePosition = vec4(vec3(screenPosition, depth) * 2.0 - 1.0, 1.0);
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {  
			return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;
		}

		float fetchDepth(const ivec2 uv) {   
			return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;
		}

		float getViewZ(const in float depth) {
			#if PERSPECTIVE_CAMERA == 1
				return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
			#else
				return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ? ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz : -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ? ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz : -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
			#if NORMAL_VECTOR_TYPE == 2
				return normalize(textureLod(tNormal, uv, 0.).rgb);
			#elif NORMAL_VECTOR_TYPE == 1
				return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
			#else
				return computeNormalFromDepth(uv);
			#endif
		}

		vec3 getSceneUvAndDepth(vec3 sampleViewPos) {
			vec4 sampleClipPos = cameraProjectionMatrix * vec4(sampleViewPos, 1.);
			vec2 sampleUv = sampleClipPos.xy / sampleClipPos.w * 0.5 + 0.5;
			float sampleSceneDepth = getDepth(sampleUv);
			return vec3(sampleUv, sampleSceneDepth);
		}
		
		void main() {
			float depth = getDepth(vUv.xy);
			if (depth >= 1.0) {
				discard;
				return;
			}
			vec3 viewPos = getViewPosition(vUv, depth);
			vec3 viewNormal = getViewNormal(vUv);

			float radiusToUse = radius;
			float distanceFalloffToUse = thickness;
			#if SCREEN_SPACE_RADIUS == 1
				float radiusScale = getViewPosition(vec2(0.5 + float(SCREEN_SPACE_RADIUS_SCALE) / resolution.x, 0.0), depth).x;
				radiusToUse *= radiusScale;
				distanceFalloffToUse *= radiusScale;
			#endif

			#if SCENE_CLIP_BOX == 1
				vec3 worldPos = (cameraWorldMatrix * vec4(viewPos, 1.0)).xyz;
				float boxDistance = length(max(vec3(0.0), max(sceneBoxMin - worldPos, worldPos - sceneBoxMax)));
				if (boxDistance > radiusToUse) {
					discard;
					return;
				}
			#endif
			
			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
			vec3 randomVec = noiseTexel.xyz * 2.0 - 1.0;
			vec3 tangent = normalize(vec3(randomVec.xy, 0.));
			vec3 bitangent = vec3(-tangent.y, tangent.x, 0.);
			mat3 kernelMatrix = mat3(tangent, bitangent, vec3(0., 0., 1.));

			const int DIRECTIONS = SAMPLES < 30 ? 3 : 5;
			const int STEPS = (SAMPLES + DIRECTIONS - 1) / DIRECTIONS;
			float ao = 0.0;
			for (int i = 0; i < DIRECTIONS; ++i) {
				
				float angle = float(i) / float(DIRECTIONS) * PI;
				vec4 sampleDir = vec4(cos(angle), sin(angle), 0., 0.5 + 0.5 * noiseTexel.w); 
				sampleDir.xyz = normalize(kernelMatrix * sampleDir.xyz);

				vec3 viewDir = normalize(-viewPos.xyz);
				vec3 sliceBitangent = normalize(cross(sampleDir.xyz, viewDir));
				vec3 sliceTangent = cross(sliceBitangent, viewDir);
				vec3 normalInSlice = normalize(viewNormal - sliceBitangent * dot(viewNormal, sliceBitangent));
				
				vec3 tangentToNormalInSlice = cross(normalInSlice, sliceBitangent);
				vec2 cosHorizons = vec2(dot(viewDir, tangentToNormalInSlice), dot(viewDir, -tangentToNormalInSlice));
				
				for (int j = 0; j < STEPS; ++j) {
					vec3 sampleViewOffset = sampleDir.xyz * radiusToUse * sampleDir.w * pow(float(j + 1) / float(STEPS), distanceExponent);	

					vec3 sampleSceneUvDepth = getSceneUvAndDepth(viewPos + sampleViewOffset);
					vec3 sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					vec3 viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.x += max(0., (sampleCosHorizon - cosHorizons.x) * mix(1., 2. / float(j + 2), distanceFallOff));
					}		

					sampleSceneUvDepth = getSceneUvAndDepth(viewPos - sampleViewOffset);
					sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.y += max(0., (sampleCosHorizon - cosHorizons.y) * mix(1., 2. / float(j + 2), distanceFallOff));
					}
				}

				vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);
				float nx = dot(normalInSlice, sliceTangent);
				float ny = dot(normalInSlice, viewDir);
				float nxb = 1. / 2. * (acos(cosHorizons.y) - acos(cosHorizons.x) + sinHorizons.x * cosHorizons.x - sinHorizons.y * cosHorizons.y);
				float nyb = 1. / 2. * (2. - cosHorizons.x * cosHorizons.x - cosHorizons.y * cosHorizons.y);
				float occlusion = nx * nxb + ny * nyb;
				ao += occlusion;
			}

			ao = clamp(ao / float(DIRECTIONS), 0., 1.);		
		#if SCENE_CLIP_BOX == 1
			ao = mix(ao, 1., smoothstep(0., radiusToUse, boxDistance));
		#endif
			ao = pow(ao, scale);

			gl_FragColor = FRAGMENT_OUTPUT;
		}`},o={name:"GTAODepthShader",defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform sampler2D tDepth;
		uniform float cameraNear;
		uniform float cameraFar;
		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {
			#if PERSPECTIVE_CAMERA == 1
				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
			#else
				return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		void main() {
			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`},l={name:"GTAOBlendShader",uniforms:{tDiffuse:{value:null},intensity:{value:1}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform float intensity;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = vec4(mix(vec3(1.), texel.rgb, intensity), texel.a);
		}`},n={name:"PoissonDenoiseShader",defines:{SAMPLES:16,SAMPLE_VECTORS:h(16,2,1),NORMAL_VECTOR_TYPE:1,DEPTH_VALUE_SOURCE:0},uniforms:{tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new r.I9Y},cameraProjectionMatrixInverse:{value:new r.kn4},lumaPhi:{value:5},depthPhi:{value:5},normalPhi:{value:5},radius:{value:4},index:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`

		varying vec2 vUv;

		uniform sampler2D tDiffuse;
		uniform sampler2D tNormal;
		uniform sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform float lumaPhi;
		uniform float depthPhi;
		uniform float normalPhi;
		uniform float radius;
		uniform int index;
		
		#include <common>
		#include <packing>

		#ifndef SAMPLE_LUMINANCE
		#define SAMPLE_LUMINANCE dot(vec3(0.2125, 0.7154, 0.0721), a)
		#endif

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(denoised, 1.)
		#endif

		float getLuminance(const in vec3 a) {
			return SAMPLE_LUMINANCE;
		}

		const vec3 poissonDisk[SAMPLES] = SAMPLE_VECTORS;

		vec3 getViewPosition(const in vec2 screenPosition, const in float depth) {
			vec4 clipSpacePosition = vec4(vec3(screenPosition, depth) * 2.0 - 1.0, 1.0);
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}
		
		float getDepth(const vec2 uv) {
		#if DEPTH_VALUE_SOURCE == 1    
			return textureLod(tDepth, uv.xy, 0.0).a;
		#else
			return textureLod(tDepth, uv.xy, 0.0).r;
		#endif
		}

		float fetchDepth(const ivec2 uv) {
			#if DEPTH_VALUE_SOURCE == 1    
				return texelFetch(tDepth, uv.xy, 0).a;
			#else
				return texelFetch(tDepth, uv.xy, 0).r;
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ?  ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz
									: -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ?  ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz
									: -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
		#if NORMAL_VECTOR_TYPE == 2
			return normalize(textureLod(tNormal, uv, 0.).rgb);
		#elif NORMAL_VECTOR_TYPE == 1
			return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
		#else
			return computeNormalFromDepth(uv);
		#endif
		}

		void denoiseSample(in vec3 center, in vec3 viewNormal, in vec3 viewPos, in vec2 sampleUv, inout vec3 denoised, inout float totalWeight) {
			vec4 sampleTexel = textureLod(tDiffuse, sampleUv, 0.0);
			float sampleDepth = getDepth(sampleUv);
			vec3 sampleNormal = getViewNormal(sampleUv);
			vec3 neighborColor = sampleTexel.rgb;
			vec3 viewPosSample = getViewPosition(sampleUv, sampleDepth);
			
			float normalDiff = dot(viewNormal, sampleNormal);
			float normalSimilarity = pow(max(normalDiff, 0.), normalPhi);
			float lumaDiff = abs(getLuminance(neighborColor) - getLuminance(center));
			float lumaSimilarity = max(1.0 - lumaDiff / lumaPhi, 0.0);
			float depthDiff = abs(dot(viewPos - viewPosSample, viewNormal));
			float depthSimilarity = max(1. - depthDiff / depthPhi, 0.);
			float w = lumaSimilarity * depthSimilarity * normalSimilarity;
		
			denoised += w * neighborColor;
			totalWeight += w;
		}
		
		void main() {
			float depth = getDepth(vUv.xy);	
			vec3 viewNormal = getViewNormal(vUv);	
			if (depth == 1. || dot(viewNormal, viewNormal) == 0.) {
				discard;
				return;
			}
			vec4 texel = textureLod(tDiffuse, vUv, 0.0);
			vec3 center = texel.rgb;
			vec3 viewPos = getViewPosition(vUv, depth);

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
      		vec2 noiseVec = vec2(sin(noiseTexel[index % 4] * 2. * PI), cos(noiseTexel[index % 4] * 2. * PI));
    		mat2 rotationMatrix = mat2(noiseVec.x, -noiseVec.y, noiseVec.x, noiseVec.y);
		
			float totalWeight = 1.0;
			vec3 denoised = texel.rgb;
			for (int i = 0; i < SAMPLES; i++) {
				vec3 sampleDir = poissonDisk[i];
				vec2 offset = rotationMatrix * (sampleDir.xy * (1. + sampleDir.z * (radius - 1.)) / resolution);
				vec2 sampleUv = vUv + offset;
				denoiseSample(center, viewNormal, viewPos, sampleUv, denoised, totalWeight);
			}
		
			if (totalWeight > 0.) { 
				denoised /= totalWeight;
			}
			gl_FragColor = FRAGMENT_OUTPUT;
		}`};function h(e,t,i){let a=function(e,t,i){let a=[];for(let s=0;s<e;s++){let o=2*Math.PI*t*s/e,l=Math.pow(s/(e-1),i);a.push(new r.Pq0(Math.cos(o),Math.sin(o),l))}return a}(e,t,i),s="vec3[SAMPLES](";for(let t=0;t<e;t++){let i=a[t];s+=`vec3(${i.x}, ${i.y}, ${i.z})${t<e-1?",":")"}`}return s}var u=i(4530);class d{constructor(e=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]],this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]],this.p=[];for(let t=0;t<256;t++)this.p[t]=Math.floor(256*e.random());this.perm=[];for(let e=0;e<512;e++)this.perm[e]=this.p[255&e];this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]}dot(e,t,i){return e[0]*t+e[1]*i}dot3(e,t,i,r){return e[0]*t+e[1]*i+e[2]*r}dot4(e,t,i,r,a){return e[0]*t+e[1]*i+e[2]*r+e[3]*a}noise(e,t){let i,r,a,s,o,l=.5*(Math.sqrt(3)-1)*(e+t),n=Math.floor(e+l),h=Math.floor(t+l),u=(3-Math.sqrt(3))/6,d=(n+h)*u,c=e-(n-d),f=t-(h-d);c>f?(s=1,o=0):(s=0,o=1);let m=c-s+u,p=f-o+u,v=c-1+2*u,g=f-1+2*u,x=255&n,M=255&h,T=this.perm[x+this.perm[M]]%12,S=this.perm[x+s+this.perm[M+o]]%12,P=this.perm[x+1+this.perm[M+1]]%12,b=.5-c*c-f*f;b<0?i=0:(b*=b,i=b*b*this.dot(this.grad3[T],c,f));let w=.5-m*m-p*p;w<0?r=0:(w*=w,r=w*w*this.dot(this.grad3[S],m,p));let C=.5-v*v-g*g;return C<0?a=0:(C*=C,a=C*C*this.dot(this.grad3[P],v,g)),70*(i+r+a)}noise3d(e,t,i){let r,a,s,o,l,n,h,u,d,c,f=1/3*(e+t+i),m=Math.floor(e+f),p=Math.floor(t+f),v=Math.floor(i+f),g=1/6*(m+p+v),x=e-(m-g),M=t-(p-g),T=i-(v-g);x>=M?M>=T?(l=1,n=0,h=0,u=1,d=1,c=0):(x>=T?(l=1,n=0,h=0):(l=0,n=0,h=1),u=1,d=0,c=1):M<T?(l=0,n=0,h=1,u=0,d=1,c=1):x<T?(l=0,n=1,h=0,u=0,d=1,c=1):(l=0,n=1,h=0,u=1,d=1,c=0);let S=x-l+1/6,P=M-n+1/6,b=T-h+1/6,w=x-u+1/6*2,C=M-d+1/6*2,E=T-c+1/6*2,D=x-1+1/6*3,_=M-1+1/6*3,y=T-1+1/6*3,R=255&m,U=255&p,N=255&v,A=this.perm[R+this.perm[U+this.perm[N]]]%12,I=this.perm[R+l+this.perm[U+n+this.perm[N+h]]]%12,z=this.perm[R+u+this.perm[U+d+this.perm[N+c]]]%12,O=this.perm[R+1+this.perm[U+1+this.perm[N+1]]]%12,B=.6-x*x-M*M-T*T;B<0?r=0:(B*=B,r=B*B*this.dot3(this.grad3[A],x,M,T));let F=.6-S*S-P*P-b*b;F<0?a=0:(F*=F,a=F*F*this.dot3(this.grad3[I],S,P,b));let L=.6-w*w-C*C-E*E;L<0?s=0:(L*=L,s=L*L*this.dot3(this.grad3[z],w,C,E));let V=.6-D*D-_*_-y*y;return V<0?o=0:(V*=V,o=V*V*this.dot3(this.grad3[O],D,_,y)),32*(r+a+s+o)}noise4d(e,t,i,r){let a,s,o,l,n,h=this.grad4,u=this.simplex,d=this.perm,c=(5-Math.sqrt(5))/20,f=(Math.sqrt(5)-1)/4*(e+t+i+r),m=Math.floor(e+f),p=Math.floor(t+f),v=Math.floor(i+f),g=Math.floor(r+f),x=(m+p+v+g)*c,M=e-(m-x),T=t-(p-x),S=i-(v-x),P=r-(g-x),b=32*(M>T)+16*(M>S)+8*(T>S)+4*(M>P)+2*(T>P)+ +(S>P),w=+(u[b][0]>=3),C=+(u[b][1]>=3),E=+(u[b][2]>=3),D=+(u[b][3]>=3),_=+(u[b][0]>=2),y=+(u[b][1]>=2),R=+(u[b][2]>=2),U=+(u[b][3]>=2),N=+(u[b][0]>=1),A=+(u[b][1]>=1),I=+(u[b][2]>=1),z=+(u[b][3]>=1),O=M-w+c,B=T-C+c,F=S-E+c,L=P-D+c,V=M-_+2*c,G=T-y+2*c,k=S-R+2*c,H=P-U+2*c,j=M-N+3*c,W=T-A+3*c,Q=S-I+3*c,Y=P-z+3*c,Z=M-1+4*c,X=T-1+4*c,q=S-1+4*c,K=P-1+4*c,J=255&m,$=255&p,ee=255&v,et=255&g,ei=d[J+d[$+d[ee+d[et]]]]%32,er=d[J+w+d[$+C+d[ee+E+d[et+D]]]]%32,ea=d[J+_+d[$+y+d[ee+R+d[et+U]]]]%32,es=d[J+N+d[$+A+d[ee+I+d[et+z]]]]%32,eo=d[J+1+d[$+1+d[ee+1+d[et+1]]]]%32,el=.6-M*M-T*T-S*S-P*P;el<0?a=0:(el*=el,a=el*el*this.dot4(h[ei],M,T,S,P));let en=.6-O*O-B*B-F*F-L*L;en<0?s=0:(en*=en,s=en*en*this.dot4(h[er],O,B,F,L));let eh=.6-V*V-G*G-k*k-H*H;eh<0?o=0:(eh*=eh,o=eh*eh*this.dot4(h[ea],V,G,k,H));let eu=.6-j*j-W*W-Q*Q-Y*Y;eu<0?l=0:(eu*=eu,l=eu*eu*this.dot4(h[es],j,W,Q,Y));let ed=.6-Z*Z-X*X-q*q-K*K;return ed<0?n=0:(ed*=ed,n=ed*ed*this.dot4(h[eo],Z,X,q,K)),27*(a+s+o+l+n)}}class c extends a.o{constructor(e,t,i,h,d,c,f){super(),this.width=void 0!==i?i:512,this.height=void 0!==h?h:512,this.clear=!0,this.camera=t,this.scene=e,this.output=0,this._renderGBuffer=!0,this._visibilityCache=new Map,this.blendIntensity=1,this.pdRings=2,this.pdRadiusExponent=2,this.pdSamples=16,this.gtaoNoiseTexture=function(e=5){let t=Math.floor(e)%2==0?Math.floor(e)+1:Math.floor(e),i=function(e){let t=Math.floor(e)%2==0?Math.floor(e)+1:Math.floor(e),i=t*t,r=Array(i).fill(0),a=Math.floor(t/2),s=t-1;for(let e=1;e<=i;){if(-1===a&&s===t?(s=t-2,a=0):(s===t&&(s=0),a<0&&(a=t-1)),0!==r[a*t+s]){s-=2,a++;continue}r[a*t+s]=e++,s++,a--}return r}(t),a=i.length,s=new Uint8Array(4*a);for(let e=0;e<a;++e){let t=2*Math.PI*i[e]/a,o=new r.Pq0(Math.cos(t),Math.sin(t),0).normalize();s[4*e]=(.5*o.x+.5)*255,s[4*e+1]=(.5*o.y+.5)*255,s[4*e+2]=127,s[4*e+3]=255}let o=new r.GYF(s,t,t);return o.wrapS=r.GJx,o.wrapT=r.GJx,o.needsUpdate=!0,o}(),this.pdNoiseTexture=this.generateNoise(),this.gtaoRenderTarget=new r.nWS(this.width,this.height,{type:r.ix0}),this.pdRenderTarget=this.gtaoRenderTarget.clone(),this.gtaoMaterial=new r.BKk({defines:Object.assign({},s.defines),uniforms:r.LlO.clone(s.uniforms),vertexShader:s.vertexShader,fragmentShader:s.fragmentShader,blending:r.XIg,depthTest:!1,depthWrite:!1}),this.gtaoMaterial.defines.PERSPECTIVE_CAMERA=+!!this.camera.isPerspectiveCamera,this.gtaoMaterial.uniforms.tNoise.value=this.gtaoNoiseTexture,this.gtaoMaterial.uniforms.resolution.value.set(this.width,this.height),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.normalMaterial=new r.qBx,this.normalMaterial.blending=r.XIg,this.pdMaterial=new r.BKk({defines:Object.assign({},n.defines),uniforms:r.LlO.clone(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,depthTest:!1,depthWrite:!1}),this.pdMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.pdMaterial.uniforms.tNoise.value=this.pdNoiseTexture,this.pdMaterial.uniforms.resolution.value.set(this.width,this.height),this.pdMaterial.uniforms.lumaPhi.value=10,this.pdMaterial.uniforms.depthPhi.value=2,this.pdMaterial.uniforms.normalPhi.value=3,this.pdMaterial.uniforms.radius.value=8,this.depthRenderMaterial=new r.BKk({defines:Object.assign({},o.defines),uniforms:r.LlO.clone(o.uniforms),vertexShader:o.vertexShader,fragmentShader:o.fragmentShader,blending:r.XIg}),this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new r.BKk({uniforms:r.LlO.clone(u.Z.uniforms),vertexShader:u.Z.vertexShader,fragmentShader:u.Z.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:r.wn6,blendDst:r.ojh,blendEquation:r.gO9,blendSrcAlpha:r.hdd,blendDstAlpha:r.ojh,blendEquationAlpha:r.gO9}),this.blendMaterial=new r.BKk({uniforms:r.LlO.clone(l.uniforms),vertexShader:l.vertexShader,fragmentShader:l.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blending:r.bCz,blendSrc:r.wn6,blendDst:r.ojh,blendEquation:r.gO9,blendSrcAlpha:r.hdd,blendDstAlpha:r.ojh,blendEquationAlpha:r.gO9}),this.fsQuad=new a.F(null),this.originalClearColor=new r.Q1f,this.setGBuffer(d?d.depthTexture:void 0,d?d.normalTexture:void 0),void 0!==c&&this.updateGtaoMaterial(c),void 0!==f&&this.updatePdMaterial(f)}dispose(){this.gtaoNoiseTexture.dispose(),this.pdNoiseTexture.dispose(),this.normalRenderTarget.dispose(),this.gtaoRenderTarget.dispose(),this.pdRenderTarget.dispose(),this.normalMaterial.dispose(),this.pdMaterial.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this.fsQuad.dispose()}get gtaoMap(){return this.pdRenderTarget.texture}setGBuffer(e,t){void 0!==e?(this.depthTexture=e,this.normalTexture=t,this._renderGBuffer=!1):(this.depthTexture=new r.VCu,this.depthTexture.format=r.dcC,this.depthTexture.type=r.V3x,this.normalRenderTarget=new r.nWS(this.width,this.height,{minFilter:r.hxR,magFilter:r.hxR,type:r.ix0,depthTexture:this.depthTexture}),this.normalTexture=this.normalRenderTarget.texture,this._renderGBuffer=!0);let i=+!!this.normalTexture,a=this.depthTexture===this.normalTexture?"w":"x";this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE=i,this.gtaoMaterial.defines.DEPTH_SWIZZLING=a,this.gtaoMaterial.uniforms.tNormal.value=this.normalTexture,this.gtaoMaterial.uniforms.tDepth.value=this.depthTexture,this.pdMaterial.defines.NORMAL_VECTOR_TYPE=i,this.pdMaterial.defines.DEPTH_SWIZZLING=a,this.pdMaterial.uniforms.tNormal.value=this.normalTexture,this.pdMaterial.uniforms.tDepth.value=this.depthTexture,this.depthRenderMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture}setSceneClipBox(e){e?(this.gtaoMaterial.needsUpdate=1!==this.gtaoMaterial.defines.SCENE_CLIP_BOX,this.gtaoMaterial.defines.SCENE_CLIP_BOX=1,this.gtaoMaterial.uniforms.sceneBoxMin.value.copy(e.min),this.gtaoMaterial.uniforms.sceneBoxMax.value.copy(e.max)):(this.gtaoMaterial.needsUpdate=0===this.gtaoMaterial.defines.SCENE_CLIP_BOX,this.gtaoMaterial.defines.SCENE_CLIP_BOX=0)}updateGtaoMaterial(e){void 0!==e.radius&&(this.gtaoMaterial.uniforms.radius.value=e.radius),void 0!==e.distanceExponent&&(this.gtaoMaterial.uniforms.distanceExponent.value=e.distanceExponent),void 0!==e.thickness&&(this.gtaoMaterial.uniforms.thickness.value=e.thickness),void 0!==e.distanceFallOff&&(this.gtaoMaterial.uniforms.distanceFallOff.value=e.distanceFallOff,this.gtaoMaterial.needsUpdate=!0),void 0!==e.scale&&(this.gtaoMaterial.uniforms.scale.value=e.scale),void 0!==e.samples&&e.samples!==this.gtaoMaterial.defines.SAMPLES&&(this.gtaoMaterial.defines.SAMPLES=e.samples,this.gtaoMaterial.needsUpdate=!0),void 0!==e.screenSpaceRadius&&+!!e.screenSpaceRadius!==this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS&&(this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS=+!!e.screenSpaceRadius,this.gtaoMaterial.needsUpdate=!0)}updatePdMaterial(e){let t=!1;void 0!==e.lumaPhi&&(this.pdMaterial.uniforms.lumaPhi.value=e.lumaPhi),void 0!==e.depthPhi&&(this.pdMaterial.uniforms.depthPhi.value=e.depthPhi),void 0!==e.normalPhi&&(this.pdMaterial.uniforms.normalPhi.value=e.normalPhi),void 0!==e.radius&&e.radius!==this.radius&&(this.pdMaterial.uniforms.radius.value=e.radius),void 0!==e.radiusExponent&&e.radiusExponent!==this.pdRadiusExponent&&(this.pdRadiusExponent=e.radiusExponent,t=!0),void 0!==e.rings&&e.rings!==this.pdRings&&(this.pdRings=e.rings,t=!0),void 0!==e.samples&&e.samples!==this.pdSamples&&(this.pdSamples=e.samples,t=!0),t&&(this.pdMaterial.defines.SAMPLES=this.pdSamples,this.pdMaterial.defines.SAMPLE_VECTORS=h(this.pdSamples,this.pdRings,this.pdRadiusExponent),this.pdMaterial.needsUpdate=!0)}render(e,t,i){switch(this._renderGBuffer&&(this.overrideVisibility(),this.renderOverride(e,this.normalMaterial,this.normalRenderTarget,7829503,1),this.restoreVisibility()),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(this.camera.matrixWorld),this.renderPass(e,this.gtaoMaterial,this.gtaoRenderTarget,0xffffff,1),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.renderPass(e,this.pdMaterial,this.pdRenderTarget,0xffffff,1),this.output){case c.OUTPUT.Off:break;case c.OUTPUT.Diffuse:this.copyMaterial.uniforms.tDiffuse.value=i.texture,this.copyMaterial.blending=r.XIg,this.renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case c.OUTPUT.AO:this.copyMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.copyMaterial.blending=r.XIg,this.renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case c.OUTPUT.Denoise:this.copyMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this.copyMaterial.blending=r.XIg,this.renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case c.OUTPUT.Depth:this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.renderPass(e,this.depthRenderMaterial,this.renderToScreen?null:t);break;case c.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=r.XIg,this.renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case c.OUTPUT.Default:this.copyMaterial.uniforms.tDiffuse.value=i.texture,this.copyMaterial.blending=r.XIg,this.renderPass(e,this.copyMaterial,this.renderToScreen?null:t),this.blendMaterial.uniforms.intensity.value=this.blendIntensity,this.blendMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this.renderPass(e,this.blendMaterial,this.renderToScreen?null:t);break;default:console.warn("THREE.GTAOPass: Unknown output type.")}}renderPass(e,t,i,r,a){e.getClearColor(this.originalClearColor);let s=e.getClearAlpha(),o=e.autoClear;e.setRenderTarget(i),e.autoClear=!1,null!=r&&(e.setClearColor(r),e.setClearAlpha(a||0),e.clear()),this.fsQuad.material=t,this.fsQuad.render(e),e.autoClear=o,e.setClearColor(this.originalClearColor),e.setClearAlpha(s)}renderOverride(e,t,i,r,a){e.getClearColor(this.originalClearColor);let s=e.getClearAlpha(),o=e.autoClear;e.setRenderTarget(i),e.autoClear=!1,r=t.clearColor||r,a=t.clearAlpha||a,null!=r&&(e.setClearColor(r),e.setClearAlpha(a||0),e.clear()),this.scene.overrideMaterial=t,e.render(this.scene,this.camera),this.scene.overrideMaterial=null,e.autoClear=o,e.setClearColor(this.originalClearColor),e.setClearAlpha(s)}setSize(e,t){this.width=e,this.height=t,this.gtaoRenderTarget.setSize(e,t),this.normalRenderTarget.setSize(e,t),this.pdRenderTarget.setSize(e,t),this.gtaoMaterial.uniforms.resolution.value.set(e,t),this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.pdMaterial.uniforms.resolution.value.set(e,t),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse)}overrideVisibility(){let e=this.scene,t=this._visibilityCache;e.traverse(function(e){t.set(e,e.visible),(e.isPoints||e.isLine)&&(e.visible=!1)})}restoreVisibility(){let e=this.scene,t=this._visibilityCache;e.traverse(function(e){let i=t.get(e);e.visible=i}),t.clear()}generateNoise(e=64){let t=new d,i=new Uint8Array(e*e*4);for(let r=0;r<e;r++)for(let a=0;a<e;a++){let s=r,o=a;i[(r*e+a)*4]=(.5*t.noise(s,o)+.5)*255,i[(r*e+a)*4+1]=(.5*t.noise(s+e,o)+.5)*255,i[(r*e+a)*4+2]=(.5*t.noise(s,o+e)+.5)*255,i[(r*e+a)*4+3]=(.5*t.noise(s+e,o+e)+.5)*255}let a=new r.GYF(i,e,e,r.GWd,r.OUM);return a.wrapS=r.GJx,a.wrapT=r.GJx,a.needsUpdate=!0,a}}c.OUTPUT={Off:-1,Default:0,Diffuse:1,Depth:2,Normal:3,AO:4,Denoise:5}}}]);