.PHONY: test build

test: build
	PYTHONPATH=src python3 -m unittest discover -s tests -v
	node tests/ui_format.test.mjs
	node tests/vicinae_format.test.mjs
	node tests/vicinae_entrypoint.test.mjs

build:
	@if [ ! -f vicinae-extension/node_modules/@vicinae/api/dist/bin.js ]; then npm install --prefix vicinae-extension --no-audit --no-fund; fi
	node scripts/build.mjs
