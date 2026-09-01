---
title: "CacheRoute: Planned Prefix-Affinity Routingfor Large-Scale LLM Serving"
source: "https://arxiv.org/html/2608.19677v1"
author:
published:
created: 2026-09-01
description:
tags:
  - "clippings"
---
## CacheRoute: Planned Prefix-Affinity Routing for Large-Scale LLM Serving

###### Abstract

Prefix caching avoids prefill only when a repeated request returns to a server that still holds the prefix KV. Cache-blind balancing disperses that reuse; fixed affinity preserves it but can overload a server. CacheRoute resolves this tradeoff with a periodic routing plan. It admits high-rate keys to a stable warm set and places their assignments by expected load. Hot keys may use more than one destination, although every key in our primary semi-synthetic aggregate uses exactly one. On Llama-3.3-70B in fp8 across 60 H100 GPUs, CacheRoute sustains $176\!\pm\!11$  QPS at a 3.5-s p99 SLO, $2.3\times$ the strongest of five baselines. Served KV-cache hit rate rises from $64.1\!\pm\!1.3\%$ under cache-blind balancing to $93.2\!\pm\!0.5\%$. A second semi-synthetic aggregate and controlled 8B and burst experiments separate the effects of affinity and placement. Two 32B workloads provide the counterexamples: when affinity recovers too little KV work, its residual load skew reduces or erases the improvement. We therefore recommend gating any deployment with a shadow replay rather than enabling affinity from workload statistics alone.

Keywords: LLM serving; prefix caching; request routing; request scheduling.

## 1 Introduction

Prefix caching is now standard in LLM serving engines \[[Kwon et al.(2023)](#bib.bibx1), [Zheng et al.(2024)](#bib.bibx2)\], but the cache cannot control where a request lands. A cache-blind balancer spreads a recurring prefix across many destinations and lengthens the return time to each cache. Pinning a key to one destination restores locality, but maps key skew directly onto server queues. Cache-aware routers instead react to current cache and load state \[[Srivatsa et al.(2024)](#bib.bibx3), [Yuan et al.(2026)](#bib.bibx4)\]; once a destination fills, however, spilling the next request also forfeits the warm prefix.

This problem arises in multi-tenant conversational assistants—for example, customer-support chatbots—where each business carries a stable, reusable context across a multi-turn conversation. Such skewed, prefix-reusing serving is common across LLM serving systems and not specific to any one provider. A stable per-business context recurs across conversations, while the default balancer often sends successive requests to different model servers. Request rates also vary sharply across businesses, which rules out simple stickiness. The router must keep reusable prefixes local without creating a server whose queue sets the fleet-wide p99.

CacheRoute builds a routing table from measured per-key rates. It admits the highest-rate keys under a warm-prefix slot allocation, gives an overloaded key enough destinations to cap its expected load per destination, and places the resulting assignments with longest-processing-time-first (LPT) list scheduling. Unadmitted traffic falls back to cache-blind power-of-two choices. The table remains fixed for a control interval, favoring cache stability over per-request remapping.

Assignment and replication play different roles. In the primary distribution, even the hottest key falls below the single-destination load target; every assignment count is one. The 70B result therefore measures planned single-copy affinity, top-rate admission, and balanced placement. Only the controlled 8B experiments inject keys hot enough to exercise replication.

The main experiment serves Llama-3.3-70B in fp8 on 30 tensor-parallel-2 destinations (60 H100 GPUs). Across five paired runs, CacheRoute sustains $176\!\pm\!11$  QPS at p99 $\leq 3.5$  s; the strongest baseline, Preble, sustains $76\!\pm\!11$  QPS. At 100 offered QPS, CacheRoute’s p99 is 1.8 s, compared with 3.8–8.5 s for the five baselines. On a second distribution, the advantage is $1.6\times$ at the wider active set. The 8B ablation explains the gap: affinity raises KV hit rate, and LPT placement reduces imbalance from $3.46\times$ to $1.24\times$, moving the measured SLO knee from 240 to at least 500 QPS.

We make three contributions:

- a prefix-affinity router that plans cache locality and expected load together;
- a six-policy hardware evaluation centered on a 70B model and 60 H100 GPUs, with paired runs, a second workload distribution, and burst experiments; and
- a measured operating envelope that includes loss and tie regimes, plus evidence for using shadow replay instead of an analytic residency predictor.

Top-rate admission and LPT are established techniques; we do not claim a new scheduling primitive. The contribution lies in the routing design, its large-scale measurements, and the conditions under which operators should leave the ordinary load balancer in place.

<svg id="S1.F1.pic1" height="157.43" overflow="visible" version="1.1" viewBox="0 0 861.31 157.43" width="861.31"><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="translate(0,157.43) matrix(1 0 0 -1 0 0) translate(65.29,0) translate(0,116.32)"><g stroke-width="0.4pt"><path style="fill:none" d="M 62.24 15.75 L -62.24 15.75 C -63.77 15.75 -65.01 14.51 -65.01 12.98 L -65.01 -12.98 C -65.01 -14.51 -63.77 -15.75 -62.24 -15.75 L 62.24 -15.75 C 63.77 -15.75 65.01 -14.51 65.01 -12.98 L 65.01 12.98 C 65.01 14.51 63.77 15.75 62.24 15.75 Z M -65.01 -15.75"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 -55.33 -8.65)"><g transform="matrix(1 0 0 -1 0 22.14)"><g transform="matrix(1 0 0 1 0 8.65)"><g transform="matrix(1 0 0 -1 0 0)"><foreignObject style="--ltx-fo-width:8.65em;--ltx-fo-height:0.68em;--ltx-fo-depth:0.19em;font-size:9.25pt;" height="11.07" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="110.65"><span id="S1.F1.pic1.1" style="font-size:90%;">aggregate telemetry</span></foreignObject></g></g> <g transform="matrix(1 0 0 1 0 19.72)"><g transform="matrix(1 0 0 -1 17.48 0)"><foreignObject style="--ltx-fo-width:4.5em;--ltx-fo-height:0.68em;--ltx-fo-depth:0.19em;font-size:9.25pt;" height="11.07" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="57.64"><span id="S1.F1.pic1.2" style="font-size:90%;">key</span> <math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="b"><semantics><mi mathsize="0.900em">b</mi> <annotation encoding="application/x-tex">b</annotation></semantics></math><span id="S1.F1.pic1.3" style="font-size:90%;">, rate</span> <math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="\lambda_{b}"><semantics><msub><mi mathsize="0.900em">λ</mi> <mi mathsize="0.900em">b</mi></msub> <annotation encoding="application/x-tex">\lambda_{b}</annotation></semantics></math></foreignObject></g></g></g></g> <g style="--ltx-fill-color:#F0F0FF;" fill="#F0F0FF"><path d="M 156.75 15.75 L 88.02 15.75 C 86.49 15.75 85.25 14.51 85.25 12.98 L 85.25 -12.98 C 85.25 -14.51 86.49 -15.75 88.02 -15.75 L 156.75 -15.75 C 158.28 -15.75 159.52 -14.51 159.52 -12.98 L 159.52 12.98 C 159.52 14.51 158.28 15.75 156.75 15.75 Z M 85.25 -15.75"></path></g><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 94.94 -9.36)"><g transform="matrix(1 0 0 -1 0 18.73)"><g transform="matrix(1 0 0 1 0 7.66)"><g transform="matrix(1 0 0 -1 5.03 0)"><foreignObject style="--ltx-fo-width:3.5em;--ltx-fo-height:0.6em;--ltx-fo-depth:0.19em;font-size:9.25pt;" height="10.08" overflow="visible" transform="matrix(1 0 0 -1 0 7.66)" width="44.83"><span id="S1.F1.pic1.4" style="font-size:90%;">top-rate</span></foreignObject></g></g> <g transform="matrix(1 0 0 1 0 18.73)"><g transform="matrix(1 0 0 -1 0 0)"><foreignObject style="--ltx-fo-width:4.29em;--ltx-fo-height:0.68em;--ltx-fo-depth:0em;font-size:9.25pt;" height="8.65" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="54.89"><span id="S1.F1.pic1.5" style="font-size:90%;">admission</span></foreignObject></g></g></g></g> <g style="--ltx-fill-color:#F0F0FF;" fill="#F0F0FF"><path d="M 319.47 17.07 L 178.59 17.07 C 177.06 17.07 175.82 15.83 175.82 14.3 L 175.82 -14.3 C 175.82 -15.83 177.06 -17.07 178.59 -17.07 L 319.47 -17.07 C 321 -17.07 322.24 -15.83 322.24 -14.3 L 322.24 14.3 C 322.24 15.83 321 17.07 319.47 17.07 Z M 175.82 -17.07"></path></g><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 185.5 -8.99)"><g transform="matrix(1 0 0 -1 0 24.91)"><g transform="matrix(1 0 0 1 0 8.65)"><g transform="matrix(1 0 0 -1 33.98 0)"><foreignObject style="--ltx-fo-width:4.62em;--ltx-fo-height:0.68em;--ltx-fo-depth:0.19em;font-size:9.25pt;" height="11.07" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="59.09"><span id="S1.F1.pic1.6" style="font-size:90%;">load sizing</span></foreignObject></g></g> <g transform="matrix(1 0 0 1 0 21.45)"><g transform="matrix(1 0 0 -1 0 0)"><foreignObject style="--ltx-fo-width:9.93em;--ltx-fo-height:0.81em;--ltx-fo-depth:0.27em;font-size:9.25pt;" height="13.84" overflow="visible" transform="matrix(1 0 0 -1 0 10.38)" width="127.05"><math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="k_{b}=\max(1,\lceil\lambda_{b}/q_{\rm cap}\rceil)"><semantics><mrow><msub><mi mathsize="0.900em">k</mi> <mi mathsize="0.900em">b</mi></msub> <mo mathsize="0.900em">=</mo> <mrow><mi mathsize="0.900em">max</mi> <mo>⁡</mo> <mrow><mo maxsize="0.900em" minsize="0.900em">(</mo><mn mathsize="0.900em">1</mn><mo mathsize="0.900em">,</mo><mrow><mo stretchy="false">⌈</mo> <mrow><msub><mi mathsize="0.900em">λ</mi> <mi mathsize="0.900em">b</mi></msub> <mo maxsize="0.900em" minsize="0.900em" stretchy="true" symmetric="true">/</mo> <msub><mi mathsize="0.900em">q</mi> <mi mathsize="0.900em">cap</mi></msub></mrow> <mo stretchy="false">⌉</mo></mrow><mo maxsize="0.900em" minsize="0.900em">)</mo></mrow></mrow></mrow> <annotation encoding="application/x-tex">k_{b}=\max(1,\lceil\lambda_{b}/q_{\rm cap}\rceil)</annotation></semantics></math></foreignObject></g></g></g></g> <g style="--ltx-fill-color:#F0F0FF;" fill="#F0F0FF"><path d="M 506.69 15.75 L 341.31 15.75 C 339.78 15.75 338.54 14.51 338.54 12.98 L 338.54 -12.98 C 338.54 -14.51 339.78 -15.75 341.31 -15.75 L 506.69 -15.75 C 508.22 -15.75 509.46 -14.51 509.46 -12.98 L 509.46 12.98 C 509.46 14.51 508.22 15.75 506.69 15.75 Z M 338.54 -15.75"></path></g><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 348.23 -8.65)"><g transform="matrix(1 0 0 -1 0 22.14)"><g transform="matrix(1 0 0 1 0 8.65)"><g transform="matrix(1 0 0 -1 32.39 0)"><foreignObject style="--ltx-fo-width:6.81em;--ltx-fo-height:0.68em;--ltx-fo-depth:0.19em;font-size:9.25pt;" height="11.07" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="87.11"><span id="S1.F1.pic1.7" style="font-size:90%;">LPT placement</span></foreignObject></g></g> <g transform="matrix(1 0 0 1 0 19.72)"><g transform="matrix(1 0 0 -1 0 0)"><foreignObject style="--ltx-fo-width:11.81em;--ltx-fo-height:0.68em;--ltx-fo-depth:0.19em;font-size:9.25pt;" height="11.07" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="151.19"><span id="S1.F1.pic1.8" style="font-size:90%;">against total expected load</span></foreignObject></g></g></g></g> <path style="fill:none" d="M 661.44 15.75 L 532.46 15.75 C 530.93 15.75 529.69 14.51 529.69 12.98 L 529.69 -12.98 C 529.69 -14.51 530.93 -15.75 532.46 -15.75 L 661.44 -15.75 C 662.97 -15.75 664.21 -14.51 664.21 -12.98 L 664.21 12.98 C 664.21 14.51 662.97 15.75 661.44 15.75 Z M 529.69 -15.75"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 539.38 -8.65)"><g transform="matrix(1 0 0 -1 0 17.3)"><g transform="matrix(1 0 0 1 0 8.65)"><g transform="matrix(1 0 0 -1 25.18 0)"><foreignObject style="--ltx-fo-width:5.06em;--ltx-fo-height:0.68em;--ltx-fo-depth:0em;font-size:9.25pt;" height="8.65" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="64.79"><span id="S1.F1.pic1.9" style="font-size:90%;">stable table</span></foreignObject></g></g> <g transform="matrix(1 0 0 1 0 17.3)"><g transform="matrix(1 0 0 -1 0 0)"><foreignObject style="--ltx-fo-width:9em;--ltx-fo-height:0.68em;--ltx-fo-depth:0em;font-size:9.25pt;" height="8.65" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="115.14"><math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="T:b\mapsto"><semantics><mrow><mi mathsize="0.900em">T</mi><mo lspace="0.278em" mathsize="0.900em" rspace="0.278em">:</mo><mrow><mi mathsize="0.900em">b</mi> <mo mathsize="0.900em" stretchy="false">↦</mo></mrow></mrow> <annotation encoding="application/x-tex">T:b\mapsto</annotation></semantics></math> <span id="S1.F1.pic1.10" style="font-size:90%;">destination set</span></foreignObject></g></g></g></g> <g stroke-width="0.8pt"><path style="fill:none" d="M 65.29 0 L 77.65 0"></path><g stroke-dasharray="none" stroke-dashoffset="0.0pt" stroke-linejoin="miter" transform="matrix(1.0 0.0 0.0 1.0 77.65 0)"><path d="M 5.11 0 C 4.48 0.15 1.72 1.03 0 1.99 L 0 -1.99 C 1.72 -1.03 4.48 -0.15 5.11 0 Z"></path></g></g><g stroke-width="0.8pt"><path style="fill:none" d="M 159.79 0 L 168.22 0"></path><g stroke-dasharray="none" stroke-dashoffset="0.0pt" stroke-linejoin="miter" transform="matrix(1.0 0.0 0.0 1.0 168.22 0)"><path d="M 5.11 0 C 4.48 0.15 1.72 1.03 0 1.99 L 0 -1.99 C 1.72 -1.03 4.48 -0.15 5.11 0 Z"></path></g></g><g stroke-width="0.8pt"><path style="fill:none" d="M 322.52 0 L 330.94 0"></path><g stroke-dasharray="none" stroke-dashoffset="0.0pt" stroke-linejoin="miter" transform="matrix(1.0 0.0 0.0 1.0 330.94 0)"><path d="M 5.11 0 C 4.48 0.15 1.72 1.03 0 1.99 L 0 -1.99 C 1.72 -1.03 4.48 -0.15 5.11 0 Z"></path></g></g><g stroke-width="0.8pt"><path style="fill:none" d="M 509.73 0 L 522.1 0"></path><g stroke-dasharray="none" stroke-dashoffset="0.0pt" stroke-linejoin="miter" transform="matrix(1.0 0.0 0.0 1.0 522.1 0)"><path d="M 5.11 0 C 4.48 0.15 1.72 1.03 0 1.99 L 0 -1.99 C 1.72 -1.03 4.48 -0.15 5.11 0 Z"></path></g></g><g stroke-dasharray="3.0pt,3.0pt" stroke-dashoffset="0.0pt"><path style="fill:none" d="M 80.82 -21.49 h 433.06 v 42.99 h -433.06 Z"></path></g><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" stroke-dasharray="3.0pt,3.0pt" stroke-dashoffset="0.0pt" transform="matrix(1.0 0.0 0.0 1.0 84.97 0)"></g><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 246.38 28.81)"><foreignObject style="--ltx-fo-width:8.67em;--ltx-fo-height:0.65em;--ltx-fo-depth:0.18em;font-size:8.5pt;" height="9.84" overflow="visible" transform="matrix(1 0 0 -1 0 7.69)" width="101.94"><span id="S1.F1.pic1.12" style="font-size:80%;">periodic offline plan</span></foreignObject></g> <path style="fill:none" d="M 307.1 -56.99 L 190.96 -56.99 C 189.43 -56.99 188.19 -58.23 188.19 -59.76 L 188.19 -85.72 C 188.19 -87.25 189.43 -88.48 190.96 -88.48 L 307.1 -88.48 C 308.63 -88.48 309.87 -87.25 309.87 -85.72 L 309.87 -59.76 C 309.87 -58.23 308.63 -56.99 307.1 -56.99 Z M 188.19 -88.48"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 197.88 -75.85)"><foreignObject style="--ltx-fo-width:7.59em;--ltx-fo-height:0.68em;--ltx-fo-depth:0.19em;font-size:9.25pt;" height="11.07" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="97.18"><span id="S1.F1.pic1.13" style="font-size:90%;">request with key</span> <math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="b"><semantics><mi mathsize="0.900em">b</mi> <annotation encoding="application/x-tex">b</annotation></semantics></math></foreignObject></g> <g style="--ltx-fill-color:#EDFFED;" fill="#EDFFED"><path d="M 416.93 -56.99 L 336.81 -56.99 C 335.28 -56.99 334.04 -58.23 334.04 -59.76 L 334.04 -85.72 C 334.04 -87.25 335.28 -88.48 336.81 -88.48 L 416.93 -88.48 C 418.46 -88.48 419.7 -87.25 419.7 -85.72 L 419.7 -59.76 C 419.7 -58.23 418.46 -56.99 416.93 -56.99 Z M 334.04 -88.48"></path></g><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 343.73 -77.06)"><foreignObject style="--ltx-fo-width:5.18em;--ltx-fo-height:0.68em;--ltx-fo-depth:0em;font-size:9.25pt;" height="8.65" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="66.29"><math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="b"><semantics><mi mathsize="0.900em">b</mi> <annotation encoding="application/x-tex">b</annotation></semantics></math> <span id="S1.F1.pic1.14" style="font-size:90%;">admitted?</span></foreignObject></g><g style="--ltx-fill-color:#EDFFED;" fill="#EDFFED"><path d="M 583.66 -37.3 L 454.52 -37.3 C 452.99 -37.3 451.75 -38.54 451.75 -40.07 L 451.75 -66.03 C 451.75 -67.56 452.99 -68.8 454.52 -68.8 L 583.66 -68.8 C 585.19 -68.8 586.43 -67.56 586.43 -66.03 L 586.43 -40.07 C 586.43 -38.54 585.19 -37.3 583.66 -37.3 Z M 451.75 -68.8"></path></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 461.43 -60.49)"><g transform="matrix(1 0 0 -1 0 21.1)"><g transform="matrix(1 0 0 1 0 8.65)"><g transform="matrix(1 0 0 -1 0 0)"><foreignObject style="--ltx-fo-width:9.01em;--ltx-fo-height:0.68em;--ltx-fo-depth:0em;font-size:9.25pt;" height="8.65" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="115.31"><span id="S1.F1.pic1.15" style="font-size:90%;">least-loaded member</span></foreignObject></g></g> <g transform="matrix(1 0 0 1 0 17.99)"><g transform="matrix(1 0 0 -1 22.38 0)"><foreignObject style="--ltx-fo-width:3.58em;--ltx-fo-height:0.68em;--ltx-fo-depth:0em;font-size:9.25pt;" height="8.65" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="45.87"><span id="S1.F1.pic1.16" style="font-size:90%;">of fixed</span> <math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="T(b)"><semantics><mrow><mi mathsize="0.900em">T</mi> <mo>⁡</mo> <mrow><mo maxsize="0.900em" minsize="0.900em">(</mo><mi mathsize="0.900em">b</mi><mo maxsize="0.900em" minsize="0.900em">)</mo></mrow></mrow> <annotation encoding="application/x-tex">T(b)</annotation></semantics></math></foreignObject></g></g></g></g> <g style="--ltx-fill-color:#EDFFED;" fill="#EDFFED"><path d="M 583.3 -84.55 L 454.52 -84.55 C 452.99 -84.55 451.75 -85.79 451.75 -87.32 L 451.75 -113.28 C 451.75 -114.8 452.99 -116.04 454.52 -116.04 L 583.3 -116.04 C 584.83 -116.04 586.07 -114.8 586.07 -113.28 L 586.07 -87.32 C 586.07 -85.79 584.83 -84.55 583.3 -84.55 Z M 451.75 -116.04"></path></g><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 461.43 -110.15)"><g transform="matrix(1 0 0 -1 0 19.72)"><g transform="matrix(1 0 0 1 0 8.65)"><g transform="matrix(1 0 0 -1 0 0)"><foreignObject style="--ltx-fo-width:9.09em;--ltx-fo-height:0.68em;--ltx-fo-depth:0.19em;font-size:9.25pt;" height="11.07" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="116.37"><span id="S1.F1.pic1.17" style="font-size:90%;">power-of-two-choices</span></foreignObject></g></g> <g transform="matrix(1 0 0 1 0 19.72)"><g transform="matrix(1 0 0 -1 1.39 0)"><foreignObject style="--ltx-fo-width:8.82em;--ltx-fo-height:0.68em;--ltx-fo-depth:0em;font-size:9.25pt;" height="8.65" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="112.89"><span id="S1.F1.pic1.18" style="font-size:90%;">over all destinations</span></foreignObject></g></g></g></g> <path style="fill:none" d="M 792.98 -60.93 L 621.25 -60.93 C 619.72 -60.93 618.48 -62.16 618.48 -63.69 L 618.48 -89.65 C 618.48 -91.18 619.72 -92.42 621.25 -92.42 L 792.98 -92.42 C 794.51 -92.42 795.75 -91.18 795.75 -89.65 L 795.75 -63.69 C 795.75 -62.16 794.51 -60.93 792.98 -60.93 Z M 618.48 -92.42"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 628.17 -84.11)"><g transform="matrix(1 0 0 -1 0 19.72)"><g transform="matrix(1 0 0 1 0 8.65)"><g transform="matrix(1 0 0 -1 26.43 0)"><foreignObject style="--ltx-fo-width:8.18em;--ltx-fo-height:0.68em;--ltx-fo-depth:0em;font-size:9.25pt;" height="8.65" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="104.68"><span id="S1.F1.pic1.19" style="font-size:90%;">model destinations</span></foreignObject></g></g> <g transform="matrix(1 0 0 1 0 17.3)"><g transform="matrix(1 0 0 -1 0 0)"><foreignObject style="--ltx-fo-width:12.39em;--ltx-fo-height:0.68em;--ltx-fo-depth:0.19em;font-size:9.25pt;" height="11.07" overflow="visible" transform="matrix(1 0 0 -1 0 8.65)" width="158.61"><span id="S1.F1.pic1.20" style="font-size:90%;">with native prefix KV cache</span></foreignObject></g></g></g></g></g> <g stroke-width="0.8pt"><path style="fill:none" d="M 310.14 -72.74 L 326.44 -72.74"></path><g stroke-dasharray="none" stroke-dashoffset="0.0pt" stroke-linejoin="miter" transform="matrix(1.0 0.0 0.0 1.0 326.44 -72.74)"><path d="M 5.11 0 C 4.48 0.15 1.72 1.03 0 1.99 L 0 -1.99 C 1.72 -1.03 4.48 -0.15 5.11 0 Z"></path></g></g><g stroke-width="0.8pt"><path style="fill:none" d="M 419.98 -66.77 L 444.22 -63.41"></path><g stroke-dasharray="none" stroke-dashoffset="0.0pt" stroke-linejoin="miter" transform="matrix(0.99052 0.13731 -0.13731 0.99052 444.22 -63.41)"><path d="M 5.11 0 C 4.48 0.15 1.72 1.03 0 1.99 L 0 -1.99 C 1.72 -1.03 4.48 -0.15 5.11 0 Z"></path></g><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 427.69 -57.27)"><foreignObject style="--ltx-fo-width:1.37em;--ltx-fo-height:0.41em;--ltx-fo-depth:0.18em;font-size:8.5pt;" height="6.92" overflow="visible" transform="matrix(1 0 0 -1 0 4.77)" width="16.07"><span id="S1.F1.pic1.21" style="font-size:80%;">yes</span></foreignObject></g></g> <g stroke-width="0.8pt"><path style="fill:none" d="M 419.98 -81.1 L 444.29 -85.82"></path><g stroke-dasharray="none" stroke-dashoffset="0.0pt" stroke-linejoin="miter" transform="matrix(0.98164 -0.19072 0.19072 0.98164 444.29 -85.82)"><path d="M 5.11 0 C 4.48 0.15 1.72 1.03 0 1.99 L 0 -1.99 C 1.72 -1.03 4.48 -0.15 5.11 0 Z"></path></g><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 414.81 -97.01)"><foreignObject style="--ltx-fo-width:3.56em;--ltx-fo-height:0.65em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.69" overflow="visible" transform="matrix(1 0 0 -1 0 7.69)" width="41.82"><span id="S1.F1.pic1.22" style="font-size:80%;">cold tail</span></foreignObject></g></g><g stroke-width="0.8pt"><path style="fill:none" d="M 586.71 -61.54 L 610.94 -64.6"></path><g stroke-dasharray="none" stroke-dashoffset="0.0pt" stroke-linejoin="miter" transform="matrix(0.99216 -0.12498 0.12498 0.99216 610.94 -64.6)"><path d="M 5.11 0 C 4.48 0.15 1.72 1.03 0 1.99 L 0 -1.99 C 1.72 -1.03 4.48 -0.15 5.11 0 Z"></path></g></g><g stroke-width="0.8pt"><path style="fill:none" d="M 586.34 -91.82 L 610.94 -88.73"></path><g stroke-dasharray="none" stroke-dashoffset="0.0pt" stroke-linejoin="miter" transform="matrix(0.99219 0.1248 -0.1248 0.99219 610.94 -88.73)"><path d="M 5.11 0 C 4.48 0.15 1.72 1.03 0 1.99 L 0 -1.99 C 1.72 -1.03 4.48 -0.15 5.11 0 Z"></path></g></g><g stroke-width="0.8pt"><g stroke-dasharray="3.0pt,3.0pt" stroke-dashoffset="0.0pt"><path style="fill:none" d="M 596.95 -16.02 L 596.95 -31.77 L 376.87 -31.77 L 376.87 -49.39"></path></g><g stroke-dasharray="none" stroke-dashoffset="0.0pt" stroke-linejoin="miter" transform="matrix(0.0 -1.0 1.0 0.0 376.87 -49.39)"><path d="M 5.11 0 C 4.48 0.15 1.72 1.03 0 1.99 L 0 -1.99 C 1.72 -1.03 4.48 -0.15 5.11 0 Z"></path></g></g></g></svg>

Figure 1: CacheRoute separates a periodic, rate-aware assignment from fast request dispatch. The main distribution has $k_{b}=1$ for every key, so its 70B improvement comes from admission, stable single-copy affinity, and balanced placement; multiple destinations are exercised only in the synthetic-whale mechanism study. Cache residency is measured, not guaranteed by the plan.

## 2 Workload and Failure Mode

### 2.1 Semi-synthetic aggregate workload

The workload models a multi-tenant conversational-assistant service (e.g., customer-support chatbots), where each business carries a stable, reusable context. Our evaluation uses a *semi-synthetic* workload: a synthetic request stream designed to mimic aggregate workload characteristics—per-key rates, inter-arrival gaps, and popularity distribution—derived from de-identified operational serving telemetry. No raw requests, conversation content, user data, or business identifiers are used. The primary summary contains 128,824 opaque business keys and has a Gini coefficient of 0.756. Roughly 4% of keys account for 47% of requests, yet no key contributes more than 0.3%. The median per-key inter-arrival coefficient of variation is 1.93, and 80.8% of requests belong to multi-turn threads.

Prompts average about 1.2K input tokens, 90% of which precede the current turn. Most of those tokens are not a routing opportunity. The global template is common to all businesses and warms on every destination; a retrieved few-shot block changes often enough to break the exact prefix in 67% of consecutive request pairs. The reusable, key-specific segment is the per-business context, about 180 tokens or 15% of the prompt. We route on the business key and benefit only when that segment returns before eviction.

We evaluate two independently derived semi-synthetic aggregates and several explicitly labeled synthetic workloads. The aggregates retain only replay statistics, including opaque-key rates and inter-arrival gaps. Neither the paper nor its artifacts contain request text, user content, business names, or business identifiers. We reserve synthetic traffic for mechanism and boundary tests, where controlling skew, burstiness, or prefix reuse matters more than matching a full workload.

### 2.2 Why balancing and stickiness both fail

For a business with rate $\lambda_{b}$ sprayed uniformly across $R$ destinations, the mean time between visits to one destination scales as $R/\lambda_{b}$. Increasing the fleet can thus make a prefix *colder* even though total cache capacity grows. If this revisit time exceeds the effective eviction time, every request repeats prefill work.

Pure affinity moves to the other extreme. A consistent hash keeps a prefix local, but the busiest hash bucket inherits the workload skew. Tail latency then follows the hottest destination rather than the fleet average. Bounded hashing and reactive reuse-versus-load policies reduce this problem, but may spill a request to a cold destination after a cap binds. The practical need is a stable many-key assignment computed with the rate distribution in view.

Deployment turns on a measurable tradeoff: whether the *recoverable* hit-rate increase outweighs the residual load skew. Model size, precision, prefix length, offered load, active-set breadth, and cache size all shift that balance. As Section 5.3 shows, a higher cache-hit rate can still accompany lower capacity.

## 3 CacheRoute

### 3.1 Planning objective

Let businesses $b\in B$ have estimated rates $\lambda_{b}$, and let the serving deployment have $R$ destinations. A destination is one independently routable model-server group; in the 70B deployment it is a tensor-parallel-2 pair. The planner produces a table $T(b)$ for a fixed control interval.

#### Load-based assignment count.

We calibrate $q_{\mathrm{cap}}$ from a single destination’s latency/load knee. A selected business receives

$$
k_{b}=\max\left(1,\left\lceil\lambda_{b}/q_{\mathrm{cap}}\right\rceil\right)
$$

destinations, making its expected load per assignment at most $q_{\mathrm{cap}}$. This is a load-control rule, not an eviction threshold or a cache-residency guarantee.

#### Warm-set admission.

The stable per-business prefixes are similar in size, so the planner represents cache allocation as $C=RW$ prefix slots, with $W$ slots per destination. It considers keys in decreasing $\lambda_{b}$ and admits them while $\sum k_{b}\leq C$. This equal-slot model does not cover workloads with heterogeneous reusable-prefix sizes; those require byte-aware measurements and admission.

#### Placement and dispatch.

Each admitted key contributes $k_{b}$ jobs of size $\lambda_{b}/k_{b}$. After initializing destinations with their expected cold-tail share, the planner visits admitted keys in decreasing-rate order and assigns each job to the least-loaded eligible destination. The procedure follows classic LPT scheduling \[[Graham(1969)](#bib.bibx5)\], but the standard approximation bound does not apply to our split jobs and distinct-destination constraint. During the control interval, admitted traffic chooses the least-loaded member of its fixed $T(b)$; other traffic uses power-of-two choices across the fleet \[[Mitzenmacher et al.(2001)](#bib.bibx6)\].

Algorithm 1 Periodic routing-table construction

 rates $\{\lambda_{b}\}$, $R$, $q_{\mathrm{cap}}$, slot allocation $C$

 for each key $b$ do

   $k_{b}\leftarrow\max(1,\lceil\lambda_{b}/q_{\mathrm{cap}}\rceil)$

 end for

 sort keys by decreasing $\lambda_{b}$; admit while $\sum k_{b}\leq C$

 initialize $L[r]$ with expected cold-tail load, $r\in[1,R]$

 for each admitted $b$ in decreasing $\lambda_{b}$ do

   $T(b)\leftarrow k_{b}$ distinct destinations with smallest $L$

  for each $r\in T(b)$ do

    $L[r]\leftarrow L[r]+\lambda_{b}/k_{b}$

  end for

 end for

 dispatch admitted $b$ within $T(b)$; otherwise use flat-LB

The planner runs in $O(|B|\log|B|+\sum_{b}k_{b}\log R)$ and runs off the request path. Measured construction time is 345 ms at $R=30$ for 128,824 businesses. The serving path is a table lookup followed by a load comparison within a small assignment set.

### 3.2 Operational semantics

The table stays fixed within a control interval. Stability avoids per-request cap thrashing, but drift can make the assignment stale. Installing a replacement table also starts some assignments cold. Section 5.4 measures both effects.

Admitted and cold-tail prefixes share the engine’s native cache and eviction policy. CacheRoute neither reserves nor migrates KV blocks and offers no analytic residency guarantee. Before enabling a table, we shadow-replay it and measure served token-weighted KV hit and latency.

For the primary distribution, $\max_{b}\lambda_{b}<q_{\mathrm{cap}}$ and therefore $k_{b}=1$ for every business. Algorithm 1 reduces to top-rate admission followed by balanced, single-copy placement. Replication remains available for overload protection but does not contribute to the main 70B result.

## 4 Experimental Method

#### Implementation.

Our client-side routing harness bypasses the serving deployment’s aggregate load balancer and sends each request according to one policy. An experiment identifier in request metadata attributes served, token-weighted KV-cache hits to the correct run. Policies use the same serving stack, request stream, warm-up exclusion, offered-load ladder, and health criteria. The routing layer neither changes model execution nor reserves cache capacity.

#### Testbeds.

The flagship system is Llama-3.3-70B in fp8, served by 30 tensor-parallel-2 destinations on 60 H100 GPUs. Each destination exposes 40,071 measured KV blocks (about 641K tokens). The mechanism testbed is Llama-3.1-8B-Instruct in bf16 on 30 single-H100 destinations. We use a 70B fp16 run only as supporting cache-pressure evidence, not for the capacity headline.

#### Workloads.

The main replay draws opaque keys from a semi-synthetic peak-hour aggregate distribution. A second, independently collected semi-synthetic aggregate distribution tests distribution shift. Poisson, CV-matched Gamma, and moving-block-bootstrap arrival processes test burst sensitivity. The 8B study uses a semi-synthetic aggregate distribution except where we explicitly inject synthetic whales.

#### Policies.

We compare against Flat-LB (power-of-two-choices), sticky consistent hashing \[[Karger et al.(1997)](#bib.bibx7)\], consistent hashing with bounded loads (CHWBL) \[[Mirrokni et al.(2018)](#bib.bibx8)\], a DualMap-style two-candidate cache/load policy \[[Yuan et al.(2026)](#bib.bibx4)\], and a Preble-style prefix-history and live-load policy \[[Srivatsa et al.(2024)](#bib.bibx3)\]. The latter three are reimplemented in our harness under a common interface; our absolute results should not be read as reproductions of their original systems. CHWBL uses $\epsilon=0.25$, selected by an offline sweep, and the Preble-style policy uses a 1.5 load-cap factor.

#### Metrics and statistics.

SLO capacity is the highest offered-QPS ladder point with p99 latency at or below the stated threshold and failure rate at most 5%. We compute the threshold independently per run and report its mean; a value at the ladder maximum is right-censored. The flagship top- $K$ 128 result uses five paired seeds $\{2,3,4,5,6\}$ and reports mean $\pm$ 95% Student- $t$ confidence intervals. The top- $K$ 256 confirmation uses eight seeds. The secondary-distribution and 8B studies use three paired seeds unless stated otherwise; their wider intervals warrant interpreting small differences as noise. KV-hit is served and token-weighted, not a simulator prediction.

## 5 Evaluation

We begin with the large-scale capacity result, then isolate the mechanism, examine workloads where affinity loses or ties, and derive the measurements required before enabling a routing plan.

### 5.1 70B on 60 H100 GPUs

Table 1 is the primary result; Figure 2 visualizes the common-load p99 and the primary SLO-capacity knee. At p99 $\leq 3.5$  s, CacheRoute sustains $176\!\pm\!11$  QPS, $2.3\times$ Preble’s $76\!\pm\!11$ and $4.2\times$ Flat-LB’s $42\!\pm\!20$. At a looser 5-s SLO, the gap narrows to $1.3\times$ over Preble (180 versus 140 QPS). At a tight 2-s SLO, CacheRoute is the only policy to pass any tested load and sustains 120 QPS; all five baselines are left-censored below the 30-QPS minimum.

Table 1: Llama-3.3-70B fp8, 30 TP2 destinations (60 H100), primary distribution, top- $K$ 128, five paired seeds. Capacity is QPS at the SLO knee; KV-hit is served and token-weighted.

| Policy | KV hit | Cap.@3.5s | Cap.@5s | p99@100 |
| --- | --- | --- | --- | --- |
| Flat-LB | $64.1{\pm}1.3$ % | $42{\pm}20$ | 80 | 5.7s |
| Sticky | $87.3{\pm}2.4$ % | 30 | $42{\pm}20$ | 8.5s |
| CHWBL | $75.6{\pm}0.8$ % | $64{\pm}11$ | $128{\pm}14$ | 3.8s |
| DualMap | $88.7{\pm}1.9$ % | $58{\pm}22$ | $84{\pm}32$ | 5.3s |
| Preble | $72.0{\pm}0.7$ % | $76{\pm}11$ | 140 | 3.8s |
| CacheRoute | $\mathbf{93.2{\pm}0.5}$ % | $\mathbf{176{\pm}11}$ | 180 | 1.8s |

<svg id="S5.F2.pic1" height="200.93" overflow="visible" version="1.1" viewBox="0 0 702.17 200.93" width="702.17"><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" stroke-width="0.4pt" transform="translate(0,200.93) matrix(1 0 0 -1 0 0) translate(76.55,0) translate(0,46.68)"><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 -36.61 139.26)"><foreignObject style="--ltx-fo-width:1.26em;--ltx-fo-height:0.65em;--ltx-fo-depth:0.22em;font-size:11.5pt;" height="13.84" overflow="visible" transform="matrix(1 0 0 -1 0 10.38)" width="20.11"><span id="S5.F2.pic1.1">(a)</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 -50.69 110.33)"><foreignObject style="--ltx-fo-width:3.48em;--ltx-fo-height:0.65em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.69" overflow="visible" transform="matrix(1 0 0 -1 0 7.69)" width="40.99"><span id="S5.F2.pic1.2" style="font-size:80%;">Flat-LB</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 -41.72 88.57)"><foreignObject style="--ltx-fo-width:2.72em;--ltx-fo-height:0.65em;--ltx-fo-depth:0.18em;font-size:8.5pt;" height="9.84" overflow="visible" transform="matrix(1 0 0 -1 0 7.69)" width="32.02"><span id="S5.F2.pic1.3" style="font-size:80%;">Sticky</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 -54.76 64.72)"><foreignObject style="--ltx-fo-width:3.83em;--ltx-fo-height:0.64em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.56" overflow="visible" transform="matrix(1 0 0 -1 0 7.56)" width="45.05"><span id="S5.F2.pic1.4" style="font-size:80%;">CHWBL</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 -57.55 42.9)"><foreignObject style="--ltx-fo-width:4.07em;--ltx-fo-height:0.65em;--ltx-fo-depth:0.18em;font-size:8.5pt;" height="9.84" overflow="visible" transform="matrix(1 0 0 -1 0 7.69)" width="47.85"><span id="S5.F2.pic1.5" style="font-size:80%;">DualMap</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 -42.55 18.99)"><foreignObject style="--ltx-fo-width:2.79em;--ltx-fo-height:0.65em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.69" overflow="visible" transform="matrix(1 0 0 -1 0 7.69)" width="32.84"><span id="S5.F2.pic1.6" style="font-size:80%;">Preble</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 -71.94 -3.84)"><foreignObject style="--ltx-fo-width:5.29em;--ltx-fo-height:0.65em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.69" overflow="visible" transform="matrix(1 0 0 -1 0 7.69)" width="62.23"><span id="S5.F2.pic1.7" style="font-size:80%;">CacheRoute</span></foreignObject></g> <g style="--ltx-stroke-color:#8A9499;--ltx-fill-color:#8A9499;--ltx-fg-color:#8A9499;" color="#8A9499" fill="#8A9499" stroke="#8A9499"><path style="stroke:none" d="M 0 107.55 M 0 107.55 L 0 120.8 L 152.6 120.8 L 152.6 107.55 Z M 152.6 120.8"></path></g><g style="--ltx-stroke-color:#8A9499;--ltx-fill-color:#8A9499;--ltx-fg-color:#8A9499;" color="#8A9499" fill="#8A9499" stroke="#8A9499"><path style="stroke:none" d="M 0 84.72 M 0 84.72 L 0 97.96 L 227.56 97.96 L 227.56 84.72 Z M 227.56 97.96"></path></g><g style="--ltx-stroke-color:#8A9499;--ltx-fill-color:#8A9499;--ltx-fg-color:#8A9499;" color="#8A9499" fill="#8A9499" stroke="#8A9499"><path style="stroke:none" d="M 0 61.88 M 0 61.88 L 0 75.13 L 101.73 75.13 L 101.73 61.88 Z M 101.73 75.13"></path></g><g style="--ltx-stroke-color:#8A9499;--ltx-fill-color:#8A9499;--ltx-fg-color:#8A9499;" color="#8A9499" fill="#8A9499" stroke="#8A9499"><path style="stroke:none" d="M 0 39.05 M 0 39.05 L 0 52.29 L 141.89 52.29 L 141.89 39.05 Z M 141.89 52.29"></path></g><g style="--ltx-stroke-color:#8A9499;--ltx-fill-color:#8A9499;--ltx-fg-color:#8A9499;" color="#8A9499" fill="#8A9499" stroke="#8A9499"><path style="stroke:none" d="M 0 16.21 M 0 16.21 L 0 29.46 L 101.73 29.46 L 101.73 16.21 Z M 101.73 29.46"></path></g><g style="--ltx-stroke-color:#1769AA;--ltx-fill-color:#1769AA;--ltx-fg-color:#1769AA;" color="#1769AA" fill="#1769AA" stroke="#1769AA"><path style="stroke:none" d="M 0 -6.62 M 0 -6.62 L 0 6.62 L 48.19 6.62 L 48.19 -6.62 Z M 48.19 6.62"></path></g><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 160.16 111.05)"><foreignObject style="--ltx-fo-width:1.28em;--ltx-fo-height:0.57em;--ltx-fo-depth:0em;font-size:7.97pt;" height="6.24" overflow="visible" transform="matrix(1 0 0 -1 0 6.24)" width="14.16"><span id="S5.F2.pic1.8" style="font-size:70%;">5.7</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 235.12 88.22)"><foreignObject style="--ltx-fo-width:1.28em;--ltx-fo-height:0.57em;--ltx-fo-depth:0em;font-size:7.97pt;" height="6.24" overflow="visible" transform="matrix(1 0 0 -1 0 6.24)" width="14.16"><span id="S5.F2.pic1.9" style="font-size:70%;">8.5</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 109.3 65.38)"><foreignObject style="--ltx-fo-width:1.28em;--ltx-fo-height:0.57em;--ltx-fo-depth:0em;font-size:7.97pt;" height="6.24" overflow="visible" transform="matrix(1 0 0 -1 0 6.24)" width="14.16"><span id="S5.F2.pic1.10" style="font-size:70%;">3.8</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 149.45 42.55)"><foreignObject style="--ltx-fo-width:1.28em;--ltx-fo-height:0.57em;--ltx-fo-depth:0em;font-size:7.97pt;" height="6.24" overflow="visible" transform="matrix(1 0 0 -1 0 6.24)" width="14.16"><span id="S5.F2.pic1.11" style="font-size:70%;">5.3</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 109.3 19.71)"><foreignObject style="--ltx-fo-width:1.28em;--ltx-fo-height:0.57em;--ltx-fo-depth:0em;font-size:7.97pt;" height="6.24" overflow="visible" transform="matrix(1 0 0 -1 0 6.24)" width="14.16"><span id="S5.F2.pic1.12" style="font-size:70%;">3.8</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 55.75 -3.12)"><foreignObject style="--ltx-fo-width:1.28em;--ltx-fo-height:0.57em;--ltx-fo-depth:0em;font-size:7.97pt;" height="6.24" overflow="visible" transform="matrix(1 0 0 -1 0 6.24)" width="14.16"><span id="S5.F2.pic1.13" style="font-size:70%;">1.8</span></foreignObject></g> <g style="--ltx-stroke-color:#B33A3A;--ltx-fill-color:#B33A3A;--ltx-fg-color:#B33A3A;" color="#B33A3A" fill="#B33A3A" stroke="#B33A3A" stroke-dasharray="3.0pt,3.0pt" stroke-dashoffset="0.0pt" stroke-width="0.8pt"><path style="fill:none" d="M 93.7 -12.56 L 93.7 126.73"></path></g><g style="--ltx-stroke-color:#B33A3A;--ltx-fill-color:#B33A3A;--ltx-fg-color:#B33A3A;" color="#B33A3A" fill="#B33A3A" stroke="#B33A3A" transform="matrix(1.0 0.0 0.0 1.0 100.73 130.02)"><foreignObject style="--ltx-fg-color:#000000;--ltx-fo-width:4.3em;--ltx-fo-height:0.64em;--ltx-fo-depth:0em;font-size:8.5pt;" color="#000000" height="7.56" overflow="visible" transform="matrix(1 0 0 -1 0 7.56)" width="50.54"><span id="S5.F2.pic1.14" style="font-size:80%;--ltx-fg-color:#B33A3A;">3.5-s SLO</span></foreignObject></g> <path style="fill:none" d="M 0 -14.16 L 245.74 -14.16"></path><g stroke-dasharray="none" stroke-dashoffset="0.0pt" stroke-linecap="round" stroke-linejoin="round" transform="matrix(1.0 0.0 0.0 1.0 246.02 -14.16)"><path style="fill:none" d="M -2.88 3.32 C -2.35 1.33 -1.18 0.39 0 0 C -1.18 -0.39 -2.35 -1.33 -2.88 -3.32"></path></g><path style="fill:none" d="M 0 -16.44 L 0 -11.87"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 -2.94 -26.66)"><foreignObject style="--ltx-fo-width:0.5em;--ltx-fo-height:0.61em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.13" overflow="visible" transform="matrix(1 0 0 -1 0 7.13)" width="5.88"><span id="S5.F2.pic1.15" style="font-size:80%;">0</span></foreignObject></g> <path style="fill:none" d="M 53.54 -16.44 L 53.54 -11.87"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 50.6 -26.66)"><foreignObject style="--ltx-fo-width:0.5em;--ltx-fo-height:0.61em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.13" overflow="visible" transform="matrix(1 0 0 -1 0 7.13)" width="5.88"><span id="S5.F2.pic1.16" style="font-size:80%;">2</span></foreignObject></g> <path style="fill:none" d="M 107.09 -16.44 L 107.09 -11.87"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 104.15 -26.66)"><foreignObject style="--ltx-fo-width:0.5em;--ltx-fo-height:0.61em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.13" overflow="visible" transform="matrix(1 0 0 -1 0 7.13)" width="5.88"><span id="S5.F2.pic1.17" style="font-size:80%;">4</span></foreignObject></g> <path style="fill:none" d="M 160.63 -16.44 L 160.63 -11.87"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 157.69 -26.66)"><foreignObject style="--ltx-fo-width:0.5em;--ltx-fo-height:0.61em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.13" overflow="visible" transform="matrix(1 0 0 -1 0 7.13)" width="5.88"><span id="S5.F2.pic1.18" style="font-size:80%;">6</span></foreignObject></g> <path style="fill:none" d="M 214.17 -16.44 L 214.17 -11.87"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 211.23 -26.66)"><foreignObject style="--ltx-fo-width:0.5em;--ltx-fo-height:0.61em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.13" overflow="visible" transform="matrix(1 0 0 -1 0 7.13)" width="5.88"><span id="S5.F2.pic1.19" style="font-size:80%;">8</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 35.56 -39.3)"><foreignObject style="--ltx-fo-width:14.89em;--ltx-fo-height:0.71em;--ltx-fo-depth:0.24em;font-size:8.5pt;" height="11.07" overflow="visible" transform="matrix(1 0 0 -1 0 8.3)" width="175.18"><span id="S5.F2.pic1.20" style="font-size:80%;">p99 TTFT at 100 offered QPS (s)</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 365.12 139.26)"><foreignObject style="--ltx-fo-width:1.33em;--ltx-fo-height:0.65em;--ltx-fo-depth:0.22em;font-size:11.5pt;" height="13.84" overflow="visible" transform="matrix(1 0 0 -1 0 10.38)" width="21.22"><span id="S5.F2.pic1.21">(b)</span></foreignObject></g> <g style="--ltx-stroke-color:#8A9499;--ltx-fill-color:#8A9499;--ltx-fg-color:#8A9499;" color="#8A9499" fill="#8A9499" stroke="#8A9499"><path style="stroke:none" d="M 360.24 107.55 M 360.24 107.55 L 360.24 120.8 L 413.15 120.8 L 413.15 107.55 Z M 413.15 120.8"></path></g><g style="--ltx-stroke-color:#8A9499;--ltx-fill-color:#8A9499;--ltx-fg-color:#8A9499;" color="#8A9499" fill="#8A9499" stroke="#8A9499"><path style="stroke:none" d="M 360.24 84.72 M 360.24 84.72 L 360.24 97.96 L 398.03 97.96 L 398.03 84.72 Z M 398.03 97.96"></path></g><g style="--ltx-stroke-color:#8A9499;--ltx-fill-color:#8A9499;--ltx-fg-color:#8A9499;" color="#8A9499" fill="#8A9499" stroke="#8A9499"><path style="stroke:none" d="M 360.24 61.88 M 360.24 61.88 L 360.24 75.13 L 440.86 75.13 L 440.86 61.88 Z M 440.86 75.13"></path></g><g style="--ltx-stroke-color:#8A9499;--ltx-fill-color:#8A9499;--ltx-fg-color:#8A9499;" color="#8A9499" fill="#8A9499" stroke="#8A9499"><path style="stroke:none" d="M 360.24 39.05 M 360.24 39.05 L 360.24 52.29 L 433.3 52.29 L 433.3 39.05 Z M 433.3 52.29"></path></g><g style="--ltx-stroke-color:#8A9499;--ltx-fill-color:#8A9499;--ltx-fg-color:#8A9499;" color="#8A9499" fill="#8A9499" stroke="#8A9499"><path style="stroke:none" d="M 360.24 16.21 M 360.24 16.21 L 360.24 29.46 L 455.98 29.46 L 455.98 16.21 Z M 455.98 29.46"></path></g><g style="--ltx-stroke-color:#1769AA;--ltx-fill-color:#1769AA;--ltx-fg-color:#1769AA;" color="#1769AA" fill="#1769AA" stroke="#1769AA"><path style="stroke:none" d="M 360.24 -6.62 M 360.24 -6.62 L 360.24 6.62 L 581.95 6.62 L 581.95 -6.62 Z M 581.95 6.62"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 387.95 114.17 L 438.34 114.17"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 387.95 111.2 L 387.95 117.14"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 438.34 111.2 L 438.34 117.14"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 398.03 91.34 L 398.03 91.34"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 398.03 88.37 L 398.03 94.31"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 398.03 88.37 L 398.03 94.31"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 427 68.5 L 454.72 68.5"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 427 65.54 L 427 71.47"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 454.72 65.54 L 454.72 71.47"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 405.59 45.67 L 461.02 45.67"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 405.59 42.7 L 405.59 48.64"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 461.02 42.7 L 461.02 48.64"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 442.12 22.83 L 469.83 22.83"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 442.12 19.87 L 442.12 25.8"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 469.83 19.87 L 469.83 25.8"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 568.1 0 L 595.81 0"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 568.1 -2.97 L 568.1 2.97"></path></g><g stroke-width="0.7pt"><path style="fill:none" d="M 595.81 -2.97 L 595.81 2.97"></path></g><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 580.37 111.63)"><foreignObject style="--ltx-fo-width:2em;--ltx-fo-height:0.57em;--ltx-fo-depth:0em;font-size:7.97pt;" height="6.24" overflow="visible" transform="matrix(1 0 0 -1 0 6.24)" width="22.06"><span id="S5.F2.pic1.22" style="font-size:70%;">42 <math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="\pm"><semantics><mo>±</mo> <annotation encoding="application/x-tex">\pm</annotation></semantics></math> 20</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 600.05 88.22)"><foreignObject style="--ltx-fo-width:1em;--ltx-fo-height:0.57em;--ltx-fo-depth:0em;font-size:7.97pt;" height="6.24" overflow="visible" transform="matrix(1 0 0 -1 0 6.24)" width="11.03"><span id="S5.F2.pic1.23" style="font-size:70%;">30</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 580.37 65.96)"><foreignObject style="--ltx-fo-width:2em;--ltx-fo-height:0.57em;--ltx-fo-depth:0em;font-size:7.97pt;" height="6.24" overflow="visible" transform="matrix(1 0 0 -1 0 6.24)" width="22.06"><span id="S5.F2.pic1.24" style="font-size:70%;">64 <math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="\pm"><semantics><mo>±</mo> <annotation encoding="application/x-tex">\pm</annotation></semantics></math> 11</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 580.37 43.12)"><foreignObject style="--ltx-fo-width:2em;--ltx-fo-height:0.57em;--ltx-fo-depth:0em;font-size:7.97pt;" height="6.24" overflow="visible" transform="matrix(1 0 0 -1 0 6.24)" width="22.06"><span id="S5.F2.pic1.25" style="font-size:70%;">58 <math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="\pm"><semantics><mo>±</mo> <annotation encoding="application/x-tex">\pm</annotation></semantics></math> 22</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 580.37 20.29)"><foreignObject style="--ltx-fo-width:2em;--ltx-fo-height:0.57em;--ltx-fo-depth:0em;font-size:7.97pt;" height="6.24" overflow="visible" transform="matrix(1 0 0 -1 0 6.24)" width="22.06"><span id="S5.F2.pic1.26" style="font-size:70%;">76 <math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="\pm"><semantics><mo>±</mo> <annotation encoding="application/x-tex">\pm</annotation></semantics></math> 11</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 574.85 -2.54)"><foreignObject style="--ltx-fo-width:2.5em;--ltx-fo-height:0.57em;--ltx-fo-depth:0em;font-size:7.97pt;" height="6.24" overflow="visible" transform="matrix(1 0 0 -1 0 6.24)" width="27.58"><span id="S5.F2.pic1.27" style="font-size:70%;">176 <math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="\pm"><semantics><mo>±</mo> <annotation encoding="application/x-tex">\pm</annotation></semantics></math> 11</span></foreignObject></g> <path style="fill:none" d="M 360.24 -14.16 L 617.93 -14.16"></path><g stroke-dasharray="none" stroke-dashoffset="0.0pt" stroke-linecap="round" stroke-linejoin="round" transform="matrix(1.0 0.0 0.0 1.0 618.21 -14.16)"><path style="fill:none" d="M -2.88 3.32 C -2.35 1.33 -1.18 0.39 0 0 C -1.18 -0.39 -2.35 -1.33 -2.88 -3.32"></path></g><path style="fill:none" d="M 360.24 -16.44 L 360.24 -11.87"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 357.3 -26.66)"><foreignObject style="--ltx-fo-width:0.5em;--ltx-fo-height:0.61em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.13" overflow="visible" transform="matrix(1 0 0 -1 0 7.13)" width="5.88"><span id="S5.F2.pic1.28" style="font-size:80%;">0</span></foreignObject></g> <path style="fill:none" d="M 423.22 -16.44 L 423.22 -11.87"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 417.34 -26.66)"><foreignObject style="--ltx-fo-width:1em;--ltx-fo-height:0.61em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.13" overflow="visible" transform="matrix(1 0 0 -1 0 7.13)" width="11.76"><span id="S5.F2.pic1.29" style="font-size:80%;">50</span></foreignObject></g> <path style="fill:none" d="M 486.21 -16.44 L 486.21 -11.87"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 477.39 -26.66)"><foreignObject style="--ltx-fo-width:1.5em;--ltx-fo-height:0.61em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.13" overflow="visible" transform="matrix(1 0 0 -1 0 7.13)" width="17.64"><span id="S5.F2.pic1.30" style="font-size:80%;">100</span></foreignObject></g> <path style="fill:none" d="M 549.2 -16.44 L 549.2 -11.87"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 540.38 -26.66)"><foreignObject style="--ltx-fo-width:1.5em;--ltx-fo-height:0.61em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.13" overflow="visible" transform="matrix(1 0 0 -1 0 7.13)" width="17.64"><span id="S5.F2.pic1.31" style="font-size:80%;">150</span></foreignObject></g> <path style="fill:none" d="M 612.19 -16.44 L 612.19 -11.87"></path><g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 603.37 -26.66)"><foreignObject style="--ltx-fo-width:1.5em;--ltx-fo-height:0.61em;--ltx-fo-depth:0em;font-size:8.5pt;" height="7.13" overflow="visible" transform="matrix(1 0 0 -1 0 7.13)" width="17.64"><span id="S5.F2.pic1.32" style="font-size:80%;">200</span></foreignObject></g> <g style="--ltx-stroke-color:#000000;--ltx-fill-color:#000000;" fill="#000000" stroke="#000000" transform="matrix(1.0 0.0 0.0 1.0 396.87 -39.3)"><foreignObject style="--ltx-fo-width:13.23em;--ltx-fo-height:0.71em;--ltx-fo-depth:0.24em;font-size:8.5pt;" height="11.07" overflow="visible" transform="matrix(1 0 0 -1 0 8.3)" width="155.57"><span id="S5.F2.pic1.33" style="font-size:80%;">SLO capacity at p99 <math xmlns="http://www.w3.org/1998/Math/MathML" display="inline" data-latex="\leq 3.5"><semantics><mrow><mo>≤</mo> <mn>3.5</mn></mrow> <annotation encoding="application/x-tex">\leq 3.5</annotation></semantics></math> s (QPS)</span></foreignObject></g></g></svg>

Figure 2: Primary 70B fp8 result on 30 TP2 destinations (60 H100), top- $K$ 128, five paired seeds. (a) Measured p99 TTFT at the common 100-QPS operating point; only CacheRoute is below the primary 3.5-s SLO. (b) Per-seed SLO-capacity knees (mean and reported 95% Student- $t$ CI); CacheRoute reaches $176\!\pm\!11$  QPS, $2.3\times$ the strongest baseline.

Cache and queue measurements explain the capacity gap. CacheRoute records a 93.2% served KV-hit rate, 29.1 points above Flat-LB. Sticky and DualMap also recover substantial reuse, but their p99s at 100 offered QPS are 8.5 and 5.3 s; locality alone does not help once a queue dominates the tail. Preble and CHWBL keep the queues more even, but their cache-hit rates fall to 72.0% and 75.6%. CacheRoute occupies the useful middle: high reuse without a comparable hot spot.

With a top- $K$ 256 active set, a dedicated eight-seed run places the 3.5-s knees at 80 QPS for CacheRoute and 60 QPS for DualMap ($1.33\times$); at 5 s they are 120 and 100 QPS. Their KV-hit rates are 82% and 60%, respectively. Failure rates at passing points remain between 0.8% and 1.4%. An earlier high-failure observation did not reproduce in this confirmation run.

#### Second semi-synthetic distribution.

Table 2 repeats the experiment with an independently collected aggregate key-rate distribution on the same 70B fp8 fleet. When top- $K$ 128 fits within the warm allocation, the three balanced cache-aware policies tie at 100 QPS. Expanding to top- $K$ 256 separates them: CacheRoute sustains 160 QPS, compared with 100 QPS for the best baseline. The comparison is useful precisely because it does not reproduce every cell of Table 1; the advantage appears only after the active set outgrows the warm allocation.

Table 2: SLO capacity (p99 $\leq 3.5$  s) on the second distribution, 70B fp8/60 H100, three paired seeds.

| Policy | top- $K$ 128 | top- $K$ 256 |
| --- | --- | --- |
| Flat-LB | 30 | 30 |
| Sticky | 30 | 60 |
| CHWBL | 100 | 60 |
| DualMap | 100 | 100 |
| Preble | 60 | 60 |
| CacheRoute | 100 | 160 |

### 5.2 What creates the improvement?

The 8B testbed reaches saturation with less load and separates locality from balance. Across the tested active-set sizes, CacheRoute never falls below Flat-LB’s measured SLO capacity (Table 3). Several results at top- $K\in\{16,32,64\}$ hit the 500-QPS sweep ceiling; those ties are right-censored, not evidence of equal capacity. The largest resolved six-policy advantage is $1.39\times$ at top- $K$ 128 and 256. At top- $K$ 2000, the warm allocation covers a smaller traffic share and CacheRoute’s measured knee falls to 360 QPS, still tied for the best result.

Table 3: 8B SLO capacity (p99 $\leq 3.5$  s), 30 H100, three paired seeds. “500” is right-censored.

| top- $K$ | Flat-LB | Sticky | CHWBL | DualMap | Preble | CacheRoute |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | 500 | 100 | 500 | 100 | 500 | 500 |
| 32 | 500 | 100 | 360 | 100 | 360 | 500 |
| 64 | 500 | 160 | 360 | 160 | 360 | 500 |
| 128 | 240 | 240 | 360 | 360 | 360 | 500 |
| 256 | 160 | 240 | 240 | 360 | 360 | 500 |
| 2000 | 100 | 360 | 160 | 360 | 160 | 360 |

Table 4 adds the components one at a time under a controlled synthetic-whale workload. Affinity raises KV hit from 56% to 88%, but also raises imbalance to $3.46\times$; capacity stays at 240 QPS. Load-proportional replication reduces imbalance to $2.60\times$, yet random placement again leaves the knee unchanged. Only after LPT placement brings imbalance down to $1.24\times$ does capacity reach the 500-QPS ceiling. Affinity recovers the cached work, while placement makes that recovery usable at saturation. The injected whales are the only reason replication appears in this ablation, so the row does not explain the primary result.

Table 4: 8B component ablation, synthetic whales, top- $K$ 128, three seeds. Capacity 500 is right-censored.

| Configuration | KV hit | Imbalance | Capacity |
| --- | --- | --- | --- |
| Flat-LB | $56{\pm}1.9$ % | $1.00\times$ | 240 |
| $+$ affinity | $88{\pm}1.5$ % | $3.46\times$ | 240 |
| $+$ replication | $88{\pm}1.6$ % | $2.60\times$ | 240 |
| $+$ LPT (full) | $90{\pm}1.0$ % | $1.24\times$ | 500 |

### 5.3 Operating envelope and negative results

Table 5 shows why affinity cannot be enabled unconditionally. The 8B synthetic-whale workload offers many recoverable misses and favors CacheRoute. For 32B aggregate workload A, affinity moves KV hit only from 1.1% to 11.8%. That improvement does not outweigh the remaining skew, and capacity falls to 0.50–0.67 $\times$ Flat-LB. Aggregate workload B reaches 8.5% affinity hit and ties Flat-LB at the 5-s SLO. The two 32B workloads are de-identified semi-synthetic aggregates run with a different model configuration from the positive 70B case. Model size by itself does not distinguish these outcomes.

Table 5: Measured operating regimes. Capacity multiplier is CacheRoute/Flat-LB; the 8B range is a single-window synthetic mechanism result, while both 32B rows use semi-synthetic aggregate distributions.

| Regime | Flat hit | Aff. hit | Cap. mult. | Result |
| --- | --- | --- | --- | --- |
| 8B synthetic whales | 9.3% | 77.0% | 2–6 $\times$ | win |
| Aggregate A–32B | 1.1% | 11.8% | 0.50–0.67 $\times$ | lose |
| Aggregate B–32B | 0.8% | 8.5% | 1.0 $\times$ | tie |

We use a short shadow replay as the deployment gate. It preserves the candidate assignment without returning its responses to users. The replay compares served KV hit, per-destination load, and p99 against Flat-LB at one load below and one load near the current knee. A cache-hit increase is not enough; the plan is enabled only when p99 or capacity improves. We repeat the gate after changes to model, precision, context length, batching, cache allocation, or the active-set distribution.

### 5.4 Burstiness and replanning

#### Arrival burstiness.

On 70B fp8/top- $K$ 128, a Gamma arrival process matched to the workload’s marginal CV=1.9 reduces CacheRoute’s 3.5-s capacity by one ladder step, from 180 to 160 QPS, while KV-hit moves from 94% to 90%. Flat-LB remains at 30 QPS. In a separate, single-sweep comparison, a moving-block bootstrap of 22,639 measured inter-arrival gaps from semi-synthetic aggregate workload A (block length 50, empirical CV=2.73) leaves CacheRoute at 180 QPS and 93% hit, while Flat-LB becomes left-censored below 30 QPS. These are two-policy, one-active-set sensitivities, not claims about all baselines. They show that the main improvement does not require smoothed arrivals.

#### Rate drift and remapping.

We perturb the primary rate vector over six intervals with a lognormal random walk ($\sigma=0.3$) and compare fresh and one-interval-stale plans at 160 QPS. Recomputing LPT from scratch changes 94.5% of key-to-destination sets, although only 1.1% of keys change assignment count. The stale plan loses 1.0 percentage point of KV hit and 192 ms of p99 on average; the worst transition loses 3.0 points and 858 ms. Installing the fresh plan, meanwhile, produces a transient 13.6-point KV-hit drop during rewarming. A deployment should therefore preserve placements until the measured staleness penalty exceeds the warm-up penalty. We have not implemented a churn-aware replanner.

#### Why we do not predict residency analytically.

We also tested a single-characteristic-time occupancy model against the 70B fp8 engine. Component-level instrumentation passed seven isolation checks, and each TP2 destination exposed 40,071 measured KV blocks. Prediction still missed served hit rate by 14.3 percentage points at the median and 44.7 points at p90. The observed curve drops sharply and then plateaus, a shape outside the tested model family. We neither size deployments with this model nor assign the shape to an engine mechanism without direct evidence. This failure is why shadow replay remains part of the deployment procedure.

## 6 Discussion and Limitations

#### What generalizes.

The planner requires a stable routing key, a reusable key-specific prefix, and rate estimates that remain useful for at least one cache-warming interval. Another routing key—a tenant, a document collection, an agent, or an application—could replace the business key used here. Because the router changes placement rather than model execution, it does not depend on a particular model architecture or cache implementation.

#### What does not yet generalize.

Equal-slot admission assumes roughly uniform stable-prefix sizes. We did not measure a byte-aware value function for heterogeneous long contexts and make no byte-knapsack or optimal-admission claim. Cold-tail traffic shares the native cache and can evict admitted prefixes. The aggregate replays preserve key popularity and, for the burst experiment, short-range gap correlation; they do not preserve exact per-key timestamps. Finally, two distributions cannot represent every market or application.

Preble, DualMap, and CHWBL are common-harness reimplementations, not the original codebases. They compare routing behavior under matched hardware but do not reproduce the published systems end to end. Several 8B knees are right-censored at 500 QPS, so we report ratios only when the sweep resolves them. The three-seed studies also have wide $t$ intervals; the five-seed flagship and eight-seed confirmation provide the stronger evidence.

#### Deployment checklist.

An operator adopting CacheRoute would begin with aggregate key rates and a single-destination measurement of $q_{\mathrm{cap}}$. After choosing a conservative warm-slot allocation, they would shadow-replay the plan and Flat-LB at matched loads, comparing served KV hit, imbalance, p99, and failures. Canary traffic would follow only if the plan wins, and the router would fall back to Flat-LB when the active set or measured p99 leaves that envelope. None of these steps requires request content.

## 8 Conclusion

CacheRoute plans prefix affinity and expected load once per control interval. On a 70B fp8 model across 60 H100 GPUs, it reaches 93.2% served KV hit and $2.3\times$ the capacity of the strongest baseline at a 3.5-s p99 SLO. The negative workloads set an equally important boundary: affinity can reduce capacity when the recoverable prefix work is small. Any real deployment would therefore measure its own boundary with shadow replay.

## Supplementary Material

The supplement records experiment provenance, secondary runs, and negative results. It adds no headline claims. Each result is labeled as multi-run hardware, single-window hardware, or calibrated simulation.

## Appendix A Workload Detail

### A.1 Semi-synthetic aggregate statistics

The routing key is an opaque business identifier, and the planner reads aggregate counts rather than request text. Table 6 reports de-identified summaries derived from operational serving telemetry and distinguishes overall prompt structure from the segment whose residency the router can affect.

Table 6: Primary workload characteristics. “Positional prefix” is not the same as the business-specific routing lever.

| Property | Measured value |
| --- | --- |
| Distinct business keys | 128,824 |
| Traffic Gini coefficient | 0.756 |
| Top-key share | $<0.3\%$ |
| Top 4% share | $\approx 47\%$ |
| Multi-turn request share | 80.8% |
| Mean requests per thread | 2.64 |
| Median per-key inter-arrival CV | 1.93 |
| Mean input length | $\approx 1.2$ K tokens |
| Tokens preceding current turn | $\approx 90\%$ |
| Stable per-business context | $\approx 180$ tokens ($15\%$) |
| Pairs whose exact prefix breaks at RAG | 67% |

Each prompt contains a global template, stable per-business context, retrieved few-shot block, and current turn. The shared template warms regardless of routing. Changes to the retrieved block often truncate exact reuse, leaving the per-business context as the stable routing-specific segment. Another application would need to identify its own stable segment before using the same design.

### A.2 Data handling

The workload inputs are aggregate per-key rates, prompt-length statistics, served cache counters, and inter-arrival gaps. Raw requests, text, user content, names, and business identifiers are absent from both the paper and its artifacts. The planner needs only $\{(b,\lambda_{b})\}$ and live destination load; $b$ may be salted or ephemeral. Synthetic workloads are labeled separately, and infrastructure measurements are reported only at experiment level, without host identifiers or per-request records.

## Appendix B Experiment Provenance and Statistics

### B.1 Study matrix

Table 7 lists the replication unit for each study. Every seed defines a separate offered-load realization and warm-up exclusion. Policies within a row share seeds and request distributions, so their capacity comparisons are paired.

Table 7: Experiment provenance. “HW” denotes real H100 execution; “sim” denotes the calibrated offline simulator. The synthetic-whale and calibrated-simulation results are supporting mechanism evidence, not broad generalization evidence.

| Study | Model/precision | Destinations | Workload | Repetitions | Evidence class |
| --- | --- | --- | --- | --- | --- |
| Primary six-policy | Llama-3.3-70B/fp8 | 30 TP2 (60 H100) | primary aggregate, top- $K$ 128 | seeds 2–6 ($n=5$) | HW/core |
| Wide active set | Llama-3.3-70B/fp8 | 30 TP2 (60 H100) | primary aggregate, top- $K$ 256 | seeds 2–9 ($n=8$) | HW/core |
| Second distribution | Llama-3.3-70B/fp8 | 30 TP2 (60 H100) | independent aggregate, $K\in\{128,256\}$ | seeds 2–4 | HW/core |
| Precision pressure | Llama-3.3-70B/fp16 | 30 TP2 (60 H100) | primary aggregate | seeds 2–4 | HW/supporting |
| 8B six-policy/ablation | Llama-3.1-8B/bf16 | 30 MP1 (30 H100) | aggregate or injected whales | seeds 2–4 | HW/mechanism |
| Burst–Gamma | Llama-3.3-70B/fp8 | 30 TP2 (60 H100) | marginal CV=1.9 | seeds 2–6 | HW/sensitivity |
| Burst–trace blocks | Llama-3.3-70B/fp8 | 30 TP2 (60 H100) | 22,639 gaps, block 50 | seeds 2–6 | HW/sensitivity |
| Drift/replan | Llama-3.3-70B/fp8 | 30 TP2 (60 H100) | six perturbed intervals | seeds 2–4 | HW/sensitivity |
| 32B negative regimes | Qwen3-32B/bf16 | 30 MP2 (60 H100) | two semi-synthetic aggregates | matched runs | HW/negative |
| Outer-boundary sweep | 8B-calibrated | $R=30$ | synthetic prefix fraction/load | seeds 2–4 | sim/supporting |

### B.2 Threshold construction

For each run and policy, capacity is the largest offered-load point whose p99 meets the SLO and whose failure rate is at most 5%. Reported capacity is the mean of these per-run knees, rather than a confidence interval around one latency measurement. A run that fails at the lowest load is left-censored; one that passes at the maximum is right-censored. The primary 70B ladder is $\{30,60,80,100,120,140,160,180,220,300\}$ QPS, and the 8B ladder is $\{30,60,100,160,240,360,500\}$ QPS.

Continuous measurements use the sample mean and a two-sided 95% Student- $t$ interval. With $n=3$, $t_{0.975,2}=4.303$, so those intervals are necessarily wide; with $n=5$, $t_{0.975,4}=2.776$. Experiments, not individual requests, are the replication units.

## Appendix C Additional 70B Results

### C.1 fp16 cache-pressure run

Table 8 checks locality under greater KV pressure. No policy meets the fp8 study’s 3.5-s SLO, so this run supplies no capacity multiplier and is not combined with the fp8 headline.

Table 8: 70B fp16, 30 TP2 destinations/60 H100, top- $K$ 128, three seeds. Capacity is zero because all policies miss the fp8 study’s 3.5-s SLO.

| Policy | Served KV hit | Capacity@3.5s |
| --- | --- | --- |
| Flat-LB | $19.5\pm 2.1\%$ | 0 |
| Sticky | $77.3\pm 0.7\%$ | 0 |
| CacheRoute | $76.4\pm 0.5\%$ | 0 |

At top- $K$ 256, KV-hit is approximately 10% for Flat-LB and 77% for CacheRoute. The comparison measures the effect of scattering at model scale; it does not show a cache-hit advantage over sticky routing.

### C.2 Top-KK256 confirmation

An earlier five-seed top- $K$ 256 sweep showed failures unrelated to load. A dedicated eight-seed confirmation on the same fp8 fleet and a finer ladder did not reproduce them: failure rates for all CacheRoute seeds are 0.8–1.4% at 30 and 60 QPS, comparable with both baselines. Table 9 reports the confirmation. We retain the earlier anomaly in the provenance but do not treat it as a repeatable policy reversal.

Table 9: Dedicated 70B fp8/top- $K$ 256 confirmation ($n=8$).

| Policy | KV hit | Cap.@3.5s | Cap.@5s |
| --- | --- | --- | --- |
| DualMap | 60% | 60 | 100 |
| CacheRoute | 82% | 80 | 120 |

## Appendix D Arrival-Process Sensitivity

The two arrival studies were run separately. Table 10 compares fixed-rate and marginal-CV-matched Gamma arrivals; Table 11 adds a moving-block bootstrap in a new sweep. Their Poisson knees differ (30 versus 60 QPS), so ratios are computed only within each table.

Table 10: Gamma sensitivity, 70B fp8/top- $K$ 128, five seeds. Capacity is at p99 $\leq 3.5$  s.

<table><thead><tr><th></th><th colspan="2">Flat-LB</th><th colspan="2">CacheRoute</th></tr><tr><th>Arrival</th><th>Cap.</th><th>KV</th><th>Cap.</th><th>KV</th></tr></thead><tbody><tr><th>Poisson</th><td>30</td><td>64%</td><td>180</td><td>94%</td></tr><tr><th>Gamma, CV=1.9</th><td>30</td><td>63%</td><td>160</td><td>90%</td></tr></tbody></table>

Table 11: Self-contained block-bootstrap sweep, 70B fp8/top- $K$ 128, five seeds. The block trace has empirical CV=2.73. Zero is left-censored below 30 QPS.

<table><thead><tr><th></th><th colspan="2">Flat-LB</th><th colspan="2">CacheRoute</th></tr><tr><th>Arrival</th><th>Cap.</th><th>KV</th><th>Cap.</th><th>KV</th></tr></thead><tbody><tr><th>Poisson</th><td>60</td><td>66%</td><td>180</td><td>93%</td></tr><tr><th>Gamma, CV=1.9</th><td>60</td><td>66%</td><td>180</td><td>93%</td></tr><tr><th>Trace blocks, CV=2.73</th><td>0</td><td>67%</td><td>180</td><td>93%</td></tr></tbody></table>

The bootstrap draws contiguous blocks of 50 from 22,639 measured inter-arrival gaps. It retains short-range gap correlation, but neither the original global order nor each key’s exact timestamp sequence. We leave timestamp-exact replay to future work.

## Appendix E Replanning Under Drift

We evolve each key’s rate for six intervals with a lognormal random walk ($\sigma=0.3$ per step) around the primary distribution. Churn uses all five transitions; the 160-QPS hardware comparison uses three transitions with paired seeds.

Table 12: Detailed replan measurements. Cache-churn is $1-$ Jaccard of consecutive assignment sets; count-churn is the fraction whose $k_{b}$ changes. Stale losses compare the previous plan with a freshly computed plan.

| Transition | Cache churn | Count churn | KV loss | p99 loss | Warmup dip |
| --- | --- | --- | --- | --- | --- |
|  |  |  | (points) | (ms) | (points) |
| $0\to 1$ | 92.5% | 1.6% | 0.1 | $-119$ | 15.6 |
| $2\to 3$ | 94.5% | 0.0% | 3.0 | $+858$ | 11.4 |
| $4\to 5$ | 98.0% | 1.6% | $-0.1$ | $-162$ | 13.8 |
| Mean | 94.5% | 1.1% | 1.0 | $+192$ | 13.6 |

Recomputing LPT from scratch accounts for the high cache churn: a key may keep the same assignment count but move to another equally loaded destination. Placement hysteresis could avoid such moves, although we have not evaluated a churn-aware algorithm. For now, installing a new table should depend on whether the measured stale-plan penalty exceeds the measured warm-up penalty.

## Appendix F 8B Sensitivity and Replication Scope

### F.1 Load target and skew

Table 13 varies the load target and injected head share on the 8B testbed. Under the base (non-whale) distribution, every key remains below even the smallest $q_{\mathrm{cap}}$, so $k_{b}=1$ throughout the sweep. The unchanged result is a sanity check, not evidence that replication is insensitive to its load target.

Table 13: 8B sensitivity, $R=30$, top- $K$ 128, three seeds. Capacities are ladder knees at p99 $\leq 3.5$  s; 500 is right-censored.

| Axis | Setting | KV (CR/flat) | CR cap. | Mult. |
| --- | --- | --- | --- | --- |
| $q_{\mathrm{cap}}$ | 50 QPS | $89\pm 0.9\%/57\%$ | 360 | $1.50\times$ |
| $q_{\mathrm{cap}}$ | 100 QPS | $91\pm 3.1\%/57\%$ | 360 | $1.50\times$ |
| $q_{\mathrm{cap}}$ | 200 QPS | $91\pm 3.2\%/57\%$ | 360 | $1.50\times$ |
| $q_{\mathrm{cap}}$ | 500 QPS | $91\pm 3.1\%/57\%$ | 360 | $1.50\times$ |
| Injected skew | 5% head | $89\pm 1.1\%/56\%$ | 500 | $3.12\times$ |
| Injected skew | 15% head | $89\pm 1.0\%/56\%$ | 500 | $2.08\times$ |
| Injected skew | 25% head | $89\pm 1.1\%/57\%$ | 500 | $2.08\times$ |
| Injected skew | 45% head | $89\pm 1.1\%/59\%$ | 500 | $2.08\times$ |

### F.2 Fleet size under fixed absolute load

Fleet size produces a non-monotonic result in the synthetic-whale sweep (Table 14). Because absolute QPS stays fixed, increasing $R$ lowers the repeat rate seen by each destination; at $R=60$, even targeted prefixes become cold. A deployment whose load scales with fleet size may behave differently.

Table 14: Synthetic-whale fleet-size sweep. The $R=8$ ramp has no passing capacity point; $R=60$ has no winning scenario.

| $R$ | Representative scenario | KV (CR/flat) | Result |
| --- | --- | --- | --- |
| 8 | 2 whales@3.0 | 45%/12% | tail/KV only |
| 30 | 8 whales@3.0 | 70%/14% | $4.44\times$ |
| 60 | 16 whales@3.0 | 32%/24% | no win |

## Appendix G Negative Hardware Regimes

The two negative regimes use Qwen3-32B in bf16 on 30 MP2 destinations (60 H100), de-identified semi-synthetic aggregates, and no injected whales. They are separate workloads from the positive 70B fp8 case. Table 15 reports measured knees rather than only ratios.

Table 15: Negative and neutral hardware regimes. A dash denotes an unreported threshold, not zero.

<table><tbody><tr><td></td><th colspan="2">KV hit</th><th colspan="2">Capacity@3.5s</th><th>Cap.@5s</th></tr><tr><th>Regime</th><th>flat</th><th>affinity</th><th>flat</th><th>CR</th><th>flat/CR</th></tr><tr><td>Aggregate A–32B</td><td>1.1%</td><td>11.8%</td><td>20</td><td>10</td><td>30/20</td></tr><tr><td>Aggregate B–32B</td><td>0.8%</td><td>8.5%</td><td>–</td><td>–</td><td>20/20</td></tr></tbody></table>

On aggregate A–32B, CacheRoute reaches $0.50\times$ Flat-LB’s capacity at 3.5 s and $0.67\times$ at 5 s. The policies tie on aggregate B–32B at 5 s. Affinity adds only 8–11 percentage points of cache hit in these workloads, too little to offset modest skew. This reversal motivates the shadow-replay gate used in the main paper.

## Appendix H Analytic Residency Model: Negative Result

Each TP2 destination in the 70B fp8 engine exposes 40,071 physical KV blocks, or approximately 641K tokens. An earlier configuration note used 30,000 blocks; the ratio between the values is $1.34\times$. Our results use the measured block count, not that ratio, as the relevant configuration.

Component instrumentation passes seven isolation tests, and the business-hit crossover remains stable across the eviction sweep (coefficient of variation 0.038 over 24 cells). A single-characteristic-time occupancy model nevertheless misses served hit rate by 14.3 percentage points at the median and 44.7 points at p90; its rank agreement also falls below the deployment target. The measured residency curve drops sharply and then plateaus, outside the tested model family. We lack direct evidence to attribute that shape to batching, block quantization, or another engine mechanism.

Physical block capacity and aggregate rates are therefore insufficient for pre-deployment sizing on this engine. The deployment interface includes a shadow replay that measures served KV hit and p99 for the candidate assignment.

#### Claim-to-evidence map.

The main claims map to the following evidence:

- The $2.3\times$ headline is supported by the 70B fp8, 60-H100, top- $K$ 128, five-seed hardware study; it is not a universal multiplier.
- The wider-active-set result is a separate eight-seed confirmation and is smaller ($1.33\times$ at 3.5 s).
- The second distribution ties at top- $K$ 128 and reaches $1.6\times$ only at top- $K$ 256.
- The 8B ablation supports the affinity/placement decomposition; only synthetic whales exercise replication, while the primary workload has $k_{b}=1$.
- Burst robustness is a two-policy, one-active-set sensitivity and is not extrapolated to the other four baselines.
- The 32B loss/tie workloads establish a deployment gate, and the failed analytic predictor supports measuring residency rather than asserting a microarchitectural cause.

[^1]: Woosuk Kwon, Zhuohan Li, Siyuan Zhuang, Ying Sheng, Lianmin Zheng, Cody Hao Yu, Joseph E. Gonzalez, Hao Zhang, and Ion Stoica. Efficient memory management for large language model serving with PagedAttention. In *Proceedings of the 29th ACM Symposium on Operating Systems Principles (SOSP)*, pages 611–626, 2023.

[^2]: Lianmin Zheng, Liangsheng Yin, Zhiqiang Xie, Chuyue Sun, Jeff Huang, Cody Yu, Shiyi Cao, Christos Kozyrakis, Ion Stoica, Joseph E. Gonzalez, Clark Barrett, and Ying Sheng. SGLang: Efficient execution of structured language model programs. In *Advances in Neural Information Processing Systems (NeurIPS)*, pages 62557–62583, 2024.

[^3]: Vikranth Srivatsa, Zijian He, Reyna Abhyankar, Dongming Li, and Yiying Zhang. Preble: Efficient distributed prompt scheduling for LLM serving. *arXiv:2407.00023*, 2024.

[^4]: Ying Yuan, Pengfei Zuo, Bo Wang, Zhangyu Chen, Zhipeng Tan, and Zhou Yu. DualMap: Enabling both cache affinity and load balancing for distributed LLM serving. *arXiv:2602.06502*, 2026.

[^5]: Ronald L. Graham. Bounds on multiprocessing timing anomalies. *SIAM Journal on Applied Mathematics*, 17(2):416–429, 1969.

[^6]: Michael Mitzenmacher, Andréa W. Richa, and Ramesh K. Sitaraman. The power of two random choices: A survey of techniques and results. In *Handbook of Randomized Computing*, pages 255–312. Springer, 2001.

[^7]: David Karger, Eric Lehman, Tom Leighton, Matthew Levine, Daniel Lewin, and Rina Panigrahy. Consistent hashing and random trees: Distributed caching protocols for relieving hot spots on the World Wide Web. In *Proceedings of the 29th ACM Symposium on Theory of Computing (STOC)*, pages 654–663, 1997.

[^8]: Vahab Mirrokni, Mikkel Thorup, and Morteza Zadimoghaddam. Consistent hashing with bounded loads. In *Proceedings of the 29th ACM–SIAM Symposium on Discrete Algorithms (SODA)*, pages 587–604, 2018.

[^9]: Huang Cheng, Xin Fei, Azzedine Boukerche, and Mohammed Almulla. GeoCover: An efficient sparse coverage protocol for RSU deployment over urban VANETs. *Ad Hoc Networks*, 24:85–102, 2015. doi:10.1016/j.adhoc.2014.07.022.

[^10]: Ruoyu Qin, Zheming Li, Weiran He, Jialei Cui, Heyi Tang, Feng Ren, Teng Ma, Shangming Cai, Yineng Zhang, Mingxing Zhang, Yongwei Wu, Weimin Zheng, and Xinran Xu. Mooncake: A KVCache-centric disaggregated architecture for LLM serving. *ACM Transactions on Storage*, 2025. doi:10.1145/3773772.

[^11]: Cunchen Hu, Heyang Huang, Junhao Hu, Jiang Xu, Xusheng Chen, Tao Xie, Chenxi Wang, Sa Wang, Yungang Bao, Ninghui Sun, and Yizhou Shan. MemServe: Context caching for disaggregated LLM serving with elastic memory pool. *arXiv:2406.17565*, 2024.

[^12]: Biao Sun, Ziming Huang, Hanyu Zhao, Wencong Xiao, Xinyi Zhang, Yong Li, and Wei Lin. Llumnix: Dynamic scheduling for large language model serving. In *Proceedings of the 18th USENIX Symposium on Operating Systems Design and Implementation (OSDI)*, pages 173–191, 2024.

[^13]: Yinmin Zhong, Shengyu Liu, Junda Chen, Jianbo Hu, Yibo Zhu, Xuanzhe Liu, Xin Jin, and Hao Zhang. DistServe: Disaggregating prefill and decoding for goodput-optimized large language model serving. In *Proceedings of the 18th USENIX Symposium on Operating Systems Design and Implementation (OSDI)*, pages 193–210, 2024.

[^14]: Pratyush Patel, Esha Choukse, Chaojie Zhang, Aashaka Shah, Iñigo Goiri, Saeed Maleki, and Ricardo Bianchini. Splitwise: Efficient generative LLM inference using phase splitting. In *Proceedings of the 51st ACM/IEEE International Symposium on Computer Architecture (ISCA)*, pages 118–132, 2024.