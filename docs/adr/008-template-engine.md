# ADR 008 — Template engine: declarative composition + sandboxed renderer

## Status

Accepted.

## Context

Requirement mentions HTML/CSS/JS templates. Arbitrary script on LED players is a severe XSS/RCE-style risk and breaks pixel-exact LED snap.

## Decision

- Authoring format is **JSON composition** (layers, bindings, animation descriptors).
- The compositor (TypeScript, canvas) is the only runtime on devices and in preview.
- Lottie is data, parsed by a known player, not user JS.
- Optional **restricted HTML subset** may compile to composition in a later milestone; it is never `innerHTML`’d on the device.
- No `eval`, no remote script tags, no unrestricted CSS expression.

Design / data / render layers stay separate as in the domain model.

## Consequences

- Designers get Canva-like power within plugins, not a web CMS.
- Marketplace templates are JSON + assets, easy to version and scan.
- Some “HTML ticker” requests become a compile step or are rejected.
