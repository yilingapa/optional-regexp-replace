const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path')

module.exports = {
  entry: path.resolve(__dirname, './index.tsx'),
  mode: 'production',
  output: {
    path: path.resolve(__dirname, '../dist/'),
    filename: 'views.[contenthash:8].js',
    publicPath: "./"
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /(node_modules)/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        ]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, './index.html')
    }),
  ],
}