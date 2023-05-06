const path = require("path");
const HtmlWebPackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  entry: "./src/main.ts",
  output: {
    filename: "bundle.js",
  },
  resolve: {
    // Add `.ts` and `.tsx` as a resolvable extension.
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.js?$/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-typescript"],
          },
        },
      },
      // all files with a `.ts` extension will be handled by `ts-loader`
      {
        test: /\.ts?$/,
        loader: "ts-loader",
      },
      {
        test: /\.html$/,
        use: [
          {
            loader: "html-loader",
            options: { minimize: true },
          },
        ],
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
        test: /\.json$/,
        use: ["json-loader"],
        type: "javascript/auto",
      },
    ],
  },
  plugins: [
    new HtmlWebPackPlugin({
      template: "./public/index.html", // read public/index.html file
      filename: "index.html", // output is index.html
    }),
    new MiniCssExtractPlugin({
      filename: "style.css",
    }),
  ],
  devServer: {
    static: "./dist",
    port: 3000,
    hot: true,
    open: true,
  },
  mode: "development",
};
