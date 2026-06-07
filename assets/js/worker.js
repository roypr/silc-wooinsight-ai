/**
 * SILC WooInsight AI - Transformers.js Web Worker
 *
 * Loads and runs the AI model in a background thread.
 * Communicates with the main thread via postMessage.
 *
 * @package SILC_WooInsight_AI
 */

'use strict';

let pipe = null;

// Load library + model immediately upon worker start.
( async function () {
	try {
		const { pipeline } = await import( 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0' );

		pipe = await pipeline( 'text-generation', 'onnx-community/Qwen2.5-Coder-0.5B-Instruct', {
			quantized: true,
			device: 'wasm',
		} );

		self.postMessage( { type: 'ready' } );
	} catch ( err ) {
		self.postMessage( { type: 'error', error: err.message || 'Failed to load model.' } );
	}
} )();

self.addEventListener( 'message', async function ( e ) {
	var msg = e.data;

	if ( msg.type === 'generate' ) {
		if ( ! pipe ) {
			self.postMessage( { type: 'error', error: 'Model not loaded.' } );
			return;
		}

		try {
			var result = await pipe( msg.prompt, {
				max_new_tokens: 300,
				temperature: 0.2,
				do_sample: false,
			} );
			self.postMessage( { type: 'result', data: result } );
		} catch ( err ) {
			self.postMessage( { type: 'error', error: err.message || 'Generation failed.' } );
		}
	}
} );
