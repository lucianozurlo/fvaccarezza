#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
retina_scale_css.py (v2)

Genera un archivo de overrides: assets/css/retina-80.css

Objetivo:
- Escalar (multiplicar) TODOS los valores numéricos en px dentro de declaraciones CSS
  usando parsing AST real (tinycss2), sin regex naive.
- Activar SOLO en "desktop retina" (por default: min-width 961px y DPR >= 2),
  sin afectar mobile (<=960px), sin usar CSS zoom.
- NO modifica los CSS originales: salida reversible.
- Idempotente: por default, no re-escribe si el contenido no cambia.

Mejoras v2 (respecto propuesta inicial):
- Respeta el ORDEN REAL de cascada leyendo index.html (<link rel="stylesheet">).
- Header estable (sin timestamp) por defecto.
- Puede insertar el <link> al final del <head> (simple o con media="...").
- Filtra @media internos claramente mobile-only (max-width <= 960) para evitar anidación inútil.
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import tinycss2
from copy import copy


# -----------------------------
# Tipos y helpers
# -----------------------------

@dataclass
class Example:
    file: str
    selector: str
    prop: str
    before: str
    after: str

@dataclass
class FileReport:
    path: Path
    decls_changed: int = 0
    px_replaced: int = 0
    rules_emitted: int = 0
    media_rules_skipped: int = 0

@dataclass
class RunReport:
    scale: float
    min_width: int
    include_pointer_fine: bool
    dpr_threshold: float
    scale_hairlines: bool
    hairline_threshold: float
    files_scanned: int = 0
    files_with_changes: int = 0
    total_decls_changed: int = 0
    total_px_replaced: int = 0
    rules_emitted: int = 0
    media_rules_skipped: int = 0
    examples: List[Example] = None
    per_file: List[FileReport] = None


def _format_number(n: float, max_decimals: int = 4) -> str:
    """Formatea floats evitando -0 y recortando ceros."""
    if abs(n) < 1e-12:
        n = 0.0
    s = f"{n:.{max_decimals}f}"
    s = s.rstrip("0").rstrip(".")
    if s == "-0":
        s = "0"
    return s


def _build_media_query(*, min_width: int, include_pointer_fine: bool, dpr_threshold: float) -> str:
    """
    Construye un @media robusto OR (coma) repitiendo min-width en cada rama.
    DPR >= 2 => min-resolution: 2dppx / 192dpi / -webkit-min-device-pixel-ratio:2.
    """
    base = f"(min-width: {min_width}px)"
    pf = " and (hover: hover) and (pointer: fine)" if include_pointer_fine else ""

    # Para dpr_threshold distinto de 2, solo es confiable en dppx; el dpi equivalente es *96.
    # -webkit-min-device-pixel-ratio acepta floats en WebKit (p.ej. 1.5), pero no es universal.
    dppx = f"{dpr_threshold:g}dppx"
    dpi = f"{(dpr_threshold * 96):g}dpi"
    wkr = f"{dpr_threshold:g}"

    parts = [
        f"{base}{pf} and (min-resolution: {dppx})",
        f"{base}{pf} and (-webkit-min-device-pixel-ratio: {wkr})",
        f"{base}{pf} and (min-resolution: {dpi})",
    ]
    return ",\n       ".join(parts)


def _extract_css_links_from_html(index_html: Path) -> List[str]:
    """
    Extrae hrefs de <link rel="stylesheet" href="...">.
    Mantiene orden de aparición.
    """
    html = index_html.read_text(encoding="utf-8", errors="ignore")

    # Regex moderada: no queremos un parser HTML completo para esto.
    # Captura rel="stylesheet" y href="...".
    # (Acepta comillas simples o dobles).
    pattern = re.compile(
        r"<link\b[^>]*\brel\s*=\s*(['\"])stylesheet\1[^>]*>",
        re.IGNORECASE
    )
    href_pat = re.compile(r"\bhref\s*=\s*(['\"])(.*?)\1", re.IGNORECASE)

    hrefs: List[str] = []
    for m in pattern.finditer(html):
        tag = m.group(0)
        hm = href_pat.search(tag)
        if not hm:
            continue
        href = hm.group(2).strip()
        hrefs.append(href)

    # Normalizar: quitar querystring/fragment si existiera
    cleaned = []
    for h in hrefs:
        h2 = h.split("#", 1)[0].split("?", 1)[0]
        cleaned.append(h2)
    return cleaned


def _resolve_css_files_in_order(root: Path, css_dir: Path, index_html: Optional[Path], out_name: str, only_linked: bool) -> List[Path]:
    """
    Lista de CSS a procesar en orden de cascada:
    - Primero los <link> del index.html que apunten al css_dir.
    - Luego (si only_linked=False), cualquier .css restante en assets/css no linkeado (orden alfabético).
    """
    css_dir = css_dir.resolve()
    out_set = {out_name}

    linked_files: List[Path] = []
    linked_set = set()

    if index_html and index_html.exists():
        hrefs = _extract_css_links_from_html(index_html)
        for href in hrefs:
            # Solo css dentro de css_dir (por ruta relativa común)
            # Permitimos "assets/css/x.css" o "./assets/css/x.css"
            norm = href.lstrip("./")
            p = (root / norm).resolve()
            if p.exists() and p.suffix.lower() == ".css" and css_dir in p.parents:
                if p.name in out_set:
                    continue
                if p not in linked_set:
                    linked_files.append(p)
                    linked_set.add(p)

    if only_linked:
        return linked_files

    # Agregar restantes no linkeados
    all_css = sorted(p for p in css_dir.rglob("*.css") if p.name not in out_set)
    rest = [p for p in all_css if p not in linked_set]
    return linked_files + rest







def _strip_comments_nested(css: str) -> str:
    """
    Elimina comentarios CSS soportando ANIDACIÓN (depth), para poder parsear archivos que
    contienen patrones inválidos como comentarios dentro de comentarios.
    - Respeta strings (no toca contenido dentro de "..." o '...').
    - Dentro de comentarios, preserva saltos de línea para mantener líneas razonables.
    """
    out = []
    i = 0
    n = len(css)
    depth = 0
    in_str = None

    while i < n:
        ch = css[i]
        nxt = css[i + 1] if i + 1 < n else ""

        # strings (solo cuando no estamos en comentario)
        if depth == 0 and in_str:
            out.append(ch)
            if ch == "\\" and i + 1 < n:
                out.append(css[i + 1])
                i += 2
                continue
            if ch == in_str:
                in_str = None
            i += 1
            continue

        if depth == 0 and ch in ("'", '"'):
            in_str = ch
            out.append(ch)
            i += 1
            continue

        # comment open/close with nesting
        if ch == "/" and nxt == "*":
            depth += 1
            # reemplazamos comentario por espacio (pero preservamos \n desde adentro)
            out.append(" ")
            i += 2
            continue

        if depth > 0 and ch == "*" and nxt == "/":
            depth -= 1
            out.append(" ")
            i += 2
            continue

        if depth > 0:
            # dentro de comentario: preservamos newlines, resto lo convertimos a espacio
            out.append("\n" if ch == "\n" else " ")
            i += 1
            continue

        # normal
        out.append(ch)
        i += 1

    return "".join(out)


# -----------------------------
# Transformación AST tokens (px)
# -----------------------------

def _scale_tokens(
    tokens,
    *,
    scale: float,
    scale_hairlines: bool,
    hairline_threshold: float,
    examples: List[Example],
    ctx: Dict[str, str],
) -> Tuple[List, bool, int]:
    """Escala DimensionTokens en px recorriendo recursivamente FunctionBlocks/Blocks.
    NO toca url(...) ni strings.
    """
    changed = False
    replaced = 0
    out = []

    for t in tokens:
        # No tocar strings ni URL tokens
        if t.type in ("string", "url"):
            out.append(t)
            continue

        # FunctionBlock: no tocar url(...), sí tocar el resto
        if t.type == "function":
            name = getattr(t, "lower_name", t.name.lower())
            if name == "url":
                out.append(t)
                continue
            inner, ch, rep = _scale_tokens(
                t.arguments,
                scale=scale,
                scale_hairlines=scale_hairlines,
                hairline_threshold=hairline_threshold,
                examples=examples,
                ctx=ctx,
            )
            if ch:
                nt = copy(t)
                nt.arguments = inner
                out.append(nt)
                changed = True
                replaced += rep
            else:
                out.append(t)
            continue

        # Bloques: () [] {}
        if t.type in ("() block", "[] block", "{} block"):
            inner, ch, rep = _scale_tokens(
                t.content,
                scale=scale,
                scale_hairlines=scale_hairlines,
                hairline_threshold=hairline_threshold,
                examples=examples,
                ctx=ctx,
            )
            if ch:
                nt = copy(t)
                nt.content = inner
                out.append(nt)
                changed = True
                replaced += rep
            else:
                out.append(t)
            continue

        # DimensionToken: 10px, -12px, 0.5px
        if t.type == "dimension" and t.lower_unit == "px":
            v = float(t.value)
            av = abs(v)

            # Hairlines: por defecto NO escalar (evita bordes borrosos)
            if (not scale_hairlines) and av <= hairline_threshold and av != 0:
                out.append(t)
                continue

            nv = v * scale
            nt = copy(t)
            nt.value = nv
            nt.representation = _format_number(nv)

            out.append(nt)
            changed = True
            replaced += 1

            if len(examples) < 12:
                examples.append(
                    Example(
                        file=ctx.get("file", ""),
                        selector=ctx.get("selector", ""),
                        prop=ctx.get("prop", ""),
                        before=f"{t.representation}{t.unit}",
                        after=f"{nt.representation}{nt.unit}",
                    )
                )
            continue

        out.append(t)

    return out, changed, replaced


# -----------------------------
# @media interno: filtro anti-mobile
# -----------------------------

_MAXW_RE = re.compile(r"max-width\s*:\s*([0-9]*\.?[0-9]+)\s*px", re.IGNORECASE)

def _is_media_clearly_mobile_only(media_prelude: str, *, min_width: int) -> bool:
    """
    Heurística: si el @media interno tiene un max-width <= (min_width-1),
    entonces no puede aplicar dentro del outer @media (min-width=min_width).
    En ese caso, lo omitimos para evitar anidar @media inútil.
    """
    lows = []
    for m in _MAXW_RE.finditer(media_prelude or ""):
        try:
            lows.append(float(m.group(1)))
        except:
            pass
    if not lows:
        return False
    # si TODOS los max-width son <= min_width-1 => mobile-only
    return all(v <= (min_width - 1) for v in lows)


def _process_rule(
    rule,
    *,
    indent: int,
    scale: float,
    scale_hairlines: bool,
    hairline_threshold: float,
    examples: List[Example],
    source_file: str,
    rep: FileReport,
    outer_min_width: int,
    keep_nested_media: bool,
) -> Optional[str]:
    """Devuelve CSS para el override de ESTE rule, o None si no hay cambios."""
    ind = " " * indent

    # Reglas normales: selector { decls }
    if rule.type == "qualified-rule":
        selector = tinycss2.serialize(rule.prelude).strip()
        decls = tinycss2.parse_declaration_list(rule.content, skip_whitespace=True, skip_comments=True)

        lines = []
        for d in decls:
            if d.type != "declaration":
                continue

            ctx = {"file": source_file, "selector": selector, "prop": d.name}
            new_tokens, ch, replaced = _scale_tokens(
                d.value,
                scale=scale,
                scale_hairlines=scale_hairlines,
                hairline_threshold=hairline_threshold,
                examples=examples,
                ctx=ctx,
            )
            if not ch:
                continue

            val = tinycss2.serialize(new_tokens).strip()
            imp = " !important" if d.important else ""
            lines.append(f"{ind}  {d.name}: {val}{imp};")

            rep.decls_changed += 1
            rep.px_replaced += replaced

        if not lines:
            return None

        rep.rules_emitted += 1
        return f"{ind}{selector} {{\n" + "\n".join(lines) + f"\n{ind}}}\n"

    # At-rules con bloque: @media/@supports/@keyframes/etc
    if rule.type == "at-rule":
        prelude = tinycss2.serialize(rule.prelude).strip() if rule.prelude is not None else ""
        if rule.content is None:
            return None

        # Filtro: @media interno mobile-only => omitimos
        if rule.at_keyword.lower() == "media" and (not keep_nested_media):
            if _is_media_clearly_mobile_only(prelude, min_width=outer_min_width):
                rep.media_rules_skipped += 1
                return None

        # 1) tratar el bloque como lista de reglas anidadas
        nested_rules = tinycss2.parse_rule_list(rule.content, skip_whitespace=True, skip_comments=True)
        children = []
        for r in nested_rules:
            css = _process_rule(
                r,
                indent=indent + 2,
                scale=scale,
                scale_hairlines=scale_hairlines,
                hairline_threshold=hairline_threshold,
                examples=examples,
                source_file=source_file,
                rep=rep,
                outer_min_width=outer_min_width,
                keep_nested_media=keep_nested_media,
            )
            if css:
                children.append(css)

        if children:
            pre = f" {prelude}" if prelude else ""
            return f"{ind}@{rule.at_keyword}{pre} {{\n" + "".join(children) + f"{ind}}}\n"

        # 2) Si no había reglas anidadas, puede ser un bloque de declaraciones (p.ej. @font-face, @page)
        decls = tinycss2.parse_declaration_list(rule.content, skip_whitespace=True, skip_comments=True)
        lines = []
        for d in decls:
            if d.type != "declaration":
                continue
            ctx = {"file": source_file, "selector": f"@{rule.at_keyword} {prelude}".strip(), "prop": d.name}
            new_tokens, ch, replaced = _scale_tokens(
                d.value,
                scale=scale,
                scale_hairlines=scale_hairlines,
                hairline_threshold=hairline_threshold,
                examples=examples,
                ctx=ctx,
            )
            if not ch:
                continue
            val = tinycss2.serialize(new_tokens).strip()
            imp = " !important" if d.important else ""
            lines.append(f"{ind}  {d.name}: {val}{imp};")
            rep.decls_changed += 1
            rep.px_replaced += replaced

        if not lines:
            return None

        rep.rules_emitted += 1
        pre = f" {prelude}" if prelude else ""
        return f"{ind}@{rule.at_keyword}{pre} {{\n" + "\n".join(lines) + f"\n{ind}}}\n"

    return None


def generate_override(
    *,
    root: Path,
    css_dir: Path,
    out_file: Path,
    css_files: List[Path],
    scale: float,
    min_width: int,
    include_pointer_fine: bool,
    dpr_threshold: float,
    scale_hairlines: bool,
    hairline_threshold: float,
    stable_header: bool,
    keep_nested_media: bool,
) -> Tuple[str, RunReport]:
    """Genera el contenido completo de retina-80.css + reporte."""
    examples: List[Example] = []
    per_file: List[FileReport] = []

    report = RunReport(
        scale=scale,
        min_width=min_width,
        include_pointer_fine=include_pointer_fine,
        dpr_threshold=dpr_threshold,
        scale_hairlines=scale_hairlines,
        hairline_threshold=hairline_threshold,
        examples=examples,
        per_file=per_file,
    )

    body_parts: List[str] = []

    for f in css_files:
        rep = FileReport(path=f)
        raw = f.read_text(encoding="utf-8", errors="ignore")
        text = _strip_comments_nested(raw)
        rules = tinycss2.parse_stylesheet(text, skip_whitespace=True, skip_comments=True)
        error_rules = [r for r in rules if getattr(r, 'type', None) == 'error']
        if error_rules:
            # No abortamos: generamos lo que se pueda y avisamos.
            print(f"WARN: CSS parse errors in {f.relative_to(root).as_posix()}: {len(error_rules)}")

        local_parts: List[str] = []
        for r in rules:
            css = _process_rule(
                r,
                indent=2,
                scale=scale,
                scale_hairlines=scale_hairlines,
                hairline_threshold=hairline_threshold,
                examples=examples,
                source_file=str(f.relative_to(root)).replace("\\", "/"),
                rep=rep,
                outer_min_width=min_width,
                keep_nested_media=keep_nested_media,
            )
            if css:
                local_parts.append(css)

        report.files_scanned += 1
        per_file.append(rep)

        report.media_rules_skipped += rep.media_rules_skipped

        if rep.decls_changed > 0:
            report.files_with_changes += 1
            report.total_decls_changed += rep.decls_changed
            report.total_px_replaced += rep.px_replaced
            report.rules_emitted += rep.rules_emitted

            body_parts.append(f"  /* ── source: {f.relative_to(root).as_posix()} ───────────────────────────── */\n")
            body_parts.extend(local_parts)

    mq = _build_media_query(min_width=min_width, include_pointer_fine=include_pointer_fine, dpr_threshold=dpr_threshold)

    # Header estable (idempotencia): sin timestamp por defecto
    header_lines = [
        "/*!",
        " * retina-80.css — AUTO-GENERATED (safe override)",
        " * Purpose: scale px-based values to 0.8 ONLY on desktop retina.",
        " * Scope: min-width >= 961px and DPR >= 2 (retina).",
        " * Notes:",
        " *  - Originals are NOT modified. Delete this file to rollback.",
        " *  - Hairlines (<= 1.0px) are preserved by default.",
        " *  - This file is regenerated; do not edit manually.",
        " */",
        "",
        ":root {",
        "  --retinaScale: 1;",
        "}",
        "",
        "/*",
        "  AUTO-VERIFICATION MAP (braces):",
        "    - MEDIA START: desktop retina -> opens the @media block below",
        "    - MEDIA END: desktop retina   -> closes with the '}' immediately above the MEDIA END comment",
        "*/",
        "",
        "/* MEDIA START: desktop retina */",
        f"@media {mq} {{",
        "  :root {",
        "    --retinaScale: 0.8;",
        "  }",
        "",
    ]

    footer_lines = [
        "}",
        "/* MEDIA END: desktop retina */",
        "",
    ]

    content = "\n".join(header_lines) + "".join(body_parts) + "\n".join(footer_lines)

    return content, report


def _write_text_if_changed(path: Path, content: str) -> Tuple[bool, Optional[Path]]:
    """
    Escribe solo si cambió. Devuelve (wrote, backup_path).
    No hace backup acá; solo compara.
    """
    if path.exists():
        old = path.read_text(encoding="utf-8", errors="ignore")
        if old == content:
            return False, None
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True, None


def _write_with_backup_if_changed(path: Path, content: str, backup: bool) -> Tuple[bool, Optional[Path]]:
    """
    Escribe solo si cambió; si cambia y backup=True, crea .bak (sin timestamp para idempotencia extra).
    """
    if path.exists():
        old = path.read_text(encoding="utf-8", errors="ignore")
        if old == content:
            return False, None
        bak_path = None
        if backup:
            bak_path = path.with_suffix(path.suffix + ".bak")
            shutil.copy2(path, bak_path)
        path.write_text(content, encoding="utf-8")
        return True, bak_path

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True, None


def _patch_index_html(index_path: Path, link_tag: str, *, dry_run: bool, backup: bool) -> Tuple[bool, Optional[Path]]:
    """Inserta el link_tag antes de </head> si no existe (por href)."""
    html = index_path.read_text(encoding="utf-8", errors="ignore")
    # detectar si ya está el href
    href_m = re.search(r'href\s*=\s*["\']([^"\']+)["\']', link_tag, re.IGNORECASE)
    href = href_m.group(1) if href_m else None
    if href and href in html:
        return False, None

    insert = "\n    " + link_tag.strip() + "\n"
    i = html.lower().rfind("</head>")
    if i == -1:
        new_html = html + insert
    else:
        new_html = html[:i] + insert + html[i:]

    if dry_run:
        return True, None

    bak_path = None
    if backup and index_path.exists():
        bak_path = index_path.with_suffix(index_path.suffix + ".bak")
        shutil.copy2(index_path, bak_path)

    index_path.write_text(new_html, encoding="utf-8")
    return True, bak_path


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description="Genera assets/css/retina-80.css escalando px SOLO en desktop retina (override).")

    ap.add_argument("--root", default=".", help="Root del proyecto (default: .)")
    ap.add_argument("--css-dir", default="assets/css", help="Carpeta CSS a escanear (default: assets/css)")
    ap.add_argument("--out", default="assets/css/retina-80.css", help="Salida (default: assets/css/retina-80.css)")

    ap.add_argument("--scale", type=float, default=0.8, help="Factor escala (default: 0.8)")
    ap.add_argument("--min-width", type=int, default=961, help="Breakpoint desktop (default: 961)")
    ap.add_argument("--dpr", type=float, default=2.0, help="Umbral DPR (default: 2.0)")

    ap.add_argument("--no-pointer-fine", action="store_true", help="No agregar (hover:hover) (pointer:fine) al @media")

    ap.add_argument("--scale-hairlines", action="store_true", help="También escalar hairlines <= umbral")
    ap.add_argument("--hairline-threshold", type=float, default=1.0, help="Umbral hairline px (default: 1.0)")

    ap.add_argument("--index", default="index.html", help="Ruta index.html para ordenar y/o parchear")
    ap.add_argument("--order-from-html", action="store_true", help="Ordenar por <link> del index.html (recomendado)")
    ap.add_argument("--only-linked", action="store_true", help="Procesar solo CSS linkeados en index.html")

    ap.add_argument("--keep-nested-media", action="store_true", help="No filtrar @media internos (mantener todos)")

    ap.add_argument("--dry-run", action="store_true", help="No escribe archivos; solo reporte")
    ap.add_argument("--apply", action="store_true", help="Escribe retina-80.css si cambió")
    ap.add_argument("--backup", action="store_true", help="Crea .bak (sin timestamp) al sobrescribir")

    ap.add_argument("--patch-html", action="store_true", help="Inserta el link a retina-80.css en index.html")
    ap.add_argument("--href", default="assets/css/retina-80.css", help="Href para el link en index.html")
    ap.add_argument("--link-media", action="store_true", help="Al parchear HTML, usa <link ... media='...'> para evitar descarga fuera del target")

    ap.add_argument("--unstable-header", action="store_true", help="(debug) Header no estable (no recomendado)")
    args = ap.parse_args(argv)

    root = Path(args.root).resolve()
    css_dir = (root / args.css_dir).resolve()
    out_file = (root / args.out).resolve()
    index_html = (root / args.index).resolve()

    if not css_dir.exists():
        print(f"ERROR: no existe css-dir: {css_dir}")
        return 2

    css_files = []
    if args.order_from_html and index_html.exists():
        css_files = _resolve_css_files_in_order(root, css_dir, index_html, out_file.name, args.only_linked)
    else:
        css_files = sorted(p for p in css_dir.rglob("*.css") if p.name != out_file.name)

    content, report = generate_override(
        root=root,
        css_dir=css_dir,
        out_file=out_file,
        css_files=css_files,
        scale=float(args.scale),
        min_width=int(args.min_width),
        include_pointer_fine=(not args.no_pointer_fine),
        dpr_threshold=float(args.dpr),
        scale_hairlines=bool(args.scale_hairlines),
        hairline_threshold=float(args.hairline_threshold),
        stable_header=(not args.unstable_header),
        keep_nested_media=bool(args.keep_nested_media),
    )

    # Reporte
    print("\n=== RETINA-80 GENERATION REPORT (v2) ===")
    print(f"scale: {report.scale}")
    print(f"desktop min-width: {report.min_width}px")
    print(f"retina threshold: DPR >= {report.dpr_threshold:g}")
    print(f"pointer/hover filter: {report.include_pointer_fine}")
    print(f"hairlines: {'ESCALAR' if report.scale_hairlines else 'NO escalar'} (<= {report.hairline_threshold}px)")
    print(f"nested @media filter: {'KEEP ALL' if args.keep_nested_media else 'SKIP mobile-only max-width<=960'}")
    print(f"css files scanned: {report.files_scanned} (order={'HTML' if args.order_from_html and index_html.exists() else 'filesystem'})")
    print(f"files with changes: {report.files_with_changes}")
    print(f"rules emitted: {report.rules_emitted}")
    print(f"decls changed: {report.total_decls_changed}")
    print(f"px tokens replaced: {report.total_px_replaced}")
    print(f"nested @media skipped: {report.media_rules_skipped}")

    touched = [r for r in report.per_file if r.decls_changed > 0]
    if touched:
        print("\nTouched files:")
        for r in touched:
            rel = r.path.relative_to(root).as_posix()
            print(f"  - {rel}: {r.decls_changed} decls | {r.px_replaced} px | skipped_media={r.media_rules_skipped}")

    if report.examples:
        print("\nExamples (first 12):")
        for ex in report.examples[:12]:
            print(f"  • {ex.file} | {ex.selector} | {ex.prop}: {ex.before} -> {ex.after}")

    if args.dry_run:
        print("\n(Dry-run) Nothing written.")
        return 0

    if not args.apply:
        print("\nNothing written (pass --apply to write).")
        return 0

    wrote, bak = _write_with_backup_if_changed(out_file, content, backup=bool(args.backup))
    if wrote:
        print(f"\nOK: wrote {out_file.relative_to(root).as_posix()}")
        if bak:
            print(f"Backup: {bak.relative_to(root).as_posix()}")
    else:
        print(f"\nOK: no changes, {out_file.relative_to(root).as_posix()} unchanged.")

    if args.patch_html:
        if not index_html.exists():
            print(f"WARN: index.html not found: {index_html}")
            return 0

        if args.link_media:
            mq = _build_media_query(min_width=int(args.min_width), include_pointer_fine=(not args.no_pointer_fine), dpr_threshold=float(args.dpr))
            link_tag = (
                "<!-- Desktop Retina 80% (auto-generated) -->\n"
                f"    <link rel=\"stylesheet\" href=\"{args.href}\" media=\"{mq}\" />"
            )
        else:
            link_tag = (
                "<!-- Desktop Retina 80% (auto-generated) -->\n"
                f"    <link rel=\"stylesheet\" href=\"{args.href}\" />"
            )

        changed, bak_html = _patch_index_html(index_html, link_tag, dry_run=False, backup=bool(args.backup))
        if changed:
            print(f"OK: patched {index_html.relative_to(root).as_posix()}")
            if bak_html:
                print(f"Backup HTML: {bak_html.relative_to(root).as_posix()}")
        else:
            print("OK: index.html already contains retina link; no changes.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
