# Third-party notices

The Bilibili video/subtitle retrieval flow is adapted from bilibili-copilot, copyright (c) 2026 Kuma, under the MIT license:

MIT License

Copyright (c) 2026 Kuma

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

The GitHub mark icon is from Primer Octicons, copyright (c) 2026 GitHub Inc., under the MIT license:

MIT License

Copyright (c) 2026 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

The HTML reading page renderer is adapted from Answer me with HTML 0.5.0,
https://github.com/QingYunA/answer-me-with-html, under the MIT license.
The browser adaptation removes Node/CLI/file access, video rendering and
interactive scripts. Source pin and regeneration instructions are recorded in
src/vendor/answer-me-with-html/README.md.

MIT License

Copyright (c) 2026 Answer me with HTML contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Other dependencies retain their own licenses in their packages. All application code is bundled locally; no remote scripts are loaded.

## Local speech recognition

- Hugging Face Transformers.js 4.3.1 is distributed under Apache-2.0. The full license is included in `licenses/Transformers-Apache-2.0.txt`.
- ONNX Runtime Web 1.31.0-dev.20260914-8d85527a0 is pinned by Transformers.js. Its JavaScript and the unmodified Asyncify WebAssembly runtime are distributed under MIT. The full license is included in `licenses/ONNX-Runtime-MIT.txt`. Source: https://github.com/microsoft/onnxruntime/tree/8d85527a010e294a26b274749f74294b2a32cec5.
- Mediabunny 1.61.4 is distributed under MPL-2.0. No Mediabunny source files are modified. Its full license is included in `licenses/Mediabunny-MPL-2.0.txt`. The corresponding original source is available in the exact npm source package https://registry.npmjs.org/mediabunny/-/mediabunny-1.61.4.tgz and at https://github.com/Vanilagy/mediabunny/tree/v1.61.4.
- @noble/hashes 2.0.1 is distributed under MIT, copyright (c) 2022 Paul Miller. The full license is included in `licenses/Noble-Hashes-MIT.txt`.
- Whisper Base ONNX model data is downloaded separately from `Xenova/whisper-base`, fixed revision `64da57285918e20ea79ea5c88eed7197933abaa8`; it is not embedded in the extension package. The model card declares Apache-2.0; the original OpenAI Whisper project uses MIT, included in `licenses/Whisper-MIT.txt`. Model source and conversion metadata: https://huggingface.co/Xenova/whisper-base/tree/64da57285918e20ea79ea5c88eed7197933abaa8.

All speech executable JavaScript and WebAssembly are packaged locally. Only model data is fetched remotely. Browser-managed on-device speech language packs are provided by the browser and are not redistributed by biliSum. The audio workflow was studied from voice-over-translation; no source code from that project was copied.

## Workbench controls

- Bits UI 2.19.5 provides the Svelte resource tabs and their keyboard/focus behavior. It is distributed under MIT, copyright (c) 2023 Hunter Johnston. The full license is included in `licenses/Bits-UI-MIT.txt`.
- @internationalized/date 3.10.1 is the fixed peer dependency used with Bits UI. It is distributed under Apache-2.0. The full license is included in `licenses/Internationalized-Date-Apache-2.0.txt`.

## Locally packaged handwriting font

BiliSum Hand is a renamed, web-optimized subset of LXGW WenKai Lite Regular
1.522, copyright 2021–2026 LXGW and copyright 2020 The Klee Project Authors.
The original font is distributed under the SIL Open Font License 1.1.
The complete license is included in `licenses/LXGW-WenKai-Lite-OFL-1.1.txt`.

The subset retains GB2312 characters, Latin and common punctuation, plus
characters used by the biliSum interface. Rare characters outside that set
use the configured system-font fallback. Font data is packaged locally;
loading the interface and exported HTML/SVG does not contact a font service.
Exported documents embed the same subset and its OFL notice. Upstream source
and reproduction details are recorded in `fonts/README.md`.

Upstream: https://github.com/lxgw/LxgwWenKai-Lite/tree/v1.522
