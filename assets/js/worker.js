/**
 * SILC WooInsight AI - Web Worker
 *
 * Loads Transformer.js and the AI model in a separate thread,
 * then runs inference on demand. Communicates with the main
 * dashboard script via postMessage.
 *
 * @package SILC_WooInsight_AI
 */

let transformerModule = null;
let pipeline = null;
let modelLoaded = false;

/**
 * Dynamically import @huggingface/transformers from CDN
 * and create the text-generation pipeline.
 */
async function initModel(progress_callback) {
	if (modelLoaded && pipeline) {
		return pipeline;
	}

	try {
		// Step 1: Load the transformers library from CDN.
		transformerModule = await import(
			'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0'
		);

		const { pipeline: createPipeline, env: tfEnv } = transformerModule;
		tfEnv.allowLocalModels = false;

		// Step 2: Create the text-generation pipeline.
		const modelId = 'onnx-community/Qwen2.5-Coder-0.5B-Instruct';

		pipeline = await createPipeline('text-generation', modelId, {
			quantized: true,
			device: 'wasm',
			progress_callback: (progressData) => {
				if (progress_callback) {
					progress_callback(progressData);
				}
			},
		});

		modelLoaded = true;
		return pipeline;
	} catch (err) {
		modelLoaded = false;
		throw err;
	}
}

/**
 * Generate SQL from a natural language question.
 */
async function generateSQL(question, schemaContext) {
	if (!pipeline) {
		throw new Error('Model not loaded.');
	}

	const prompt =
		schemaContext +
		'\n\nUSER QUESTION: ' +
		question +
		'\n\nGenerate ONLY the SQL query:';

	const result = await pipeline(prompt, {
		max_new_tokens: 1500,
		temperature: 0.2,
		do_sample: false,
	});

	let text = result[0].generated_text || '';
	// Extract just the SQL part (after the prompt).
	let sql = text.substring(text.indexOf('SELECT'));
	sql = sql.split('\n')[0]; // First line only.
	// Clean up.
	sql = sql.replace(/```sql|```/gi, '').trim();
	return sql;
}

// ----------------------------------------------------------------------- //
//  MESSAGE HANDLER
// ----------------------------------------------------------------------- //

self.addEventListener('message', async (event) => {
	const { type, question, schemaContext } = event.data;

	try {
		if (type === 'init') {
			// Start loading the model and report progress.
			self.postMessage({ status: 'init', data: { progress: 0, text: 'Starting model download...' } });

			await initModel((progressData) => {
				// Forward progress updates to the main thread.
				self.postMessage({ status: 'init', data: progressData });
			});

			self.postMessage({ status: 'ready', data: { text: 'Model loaded and ready.' } });
		} else if (type === 'generateSQL') {
			// Run inference.
			self.postMessage({ status: 'inference', data: { text: 'Running inference...' } });

			const sql = await generateSQL(question, schemaContext);

			self.postMessage({ status: 'result', output: sql });
		} else if (type === 'terminate') {
			self.close();
		}
	} catch (error) {
		self.postMessage({ status: 'error', error: error.message || 'Unknown error' });
	}
});
