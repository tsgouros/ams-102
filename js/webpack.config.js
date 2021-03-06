var path = require('path');
var HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: ['./src/index.js'],
  output: {
    path: path.resolve(__dirname, 'www'), // Was __dirname + '/www'
    filename: 'ams102.js'

  },

  devtool: 'source-map',

  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: 'babel-loader',
            query: { presets: ['react', 'es2015'] }
            //exclude: /node_modules/
          }
        ]
      },
      {
        test: /css$/,  // Covers css and mcss
        use: [
          { loader: 'style-loader'},
          {
            loader: 'css-loader',
            options: {
              modules: true
            }
          }
        ]
      },
      {
        test: /\.(eot|svg|ttf|woff|woff2)$/,
        loader: 'file-loader?name=public/fonts/[name].[ext]'
      }
    ]
  },

  resolve: {
    alias: {
      PVWStyle: path.resolve('./node_modules/paraviewweb/style'),
    },
  },

  stats: {
    errorDetails: true
  },

  plugins: [
    new HtmlWebpackPlugin({
      title: "AMS-102 App",
      filename: 'index.html'
    }),
  ]
};
