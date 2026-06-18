const path = require('path');

module.exports = {
	mode: 'production',
	entry: './assets/js/src/index.js',
	output: {
		path: path.resolve(__dirname, 'assets/js'),
		filename: 'dashboard.js',
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: ['@babel/preset-env'],
						plugins: [
							[
								'@babel/plugin-transform-react-jsx',
								{
									pragma: 'wp.element.createElement',
									pragmaFrag: 'wp.element.Fragment',
								},
							],
						],
					},
				},
			},
		],
	},
	externals: {
		'@wordpress/element': 'wp.element',
	},
};
