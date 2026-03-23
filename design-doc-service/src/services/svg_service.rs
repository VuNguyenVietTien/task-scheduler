use crate::error::AppError;

/// Validate SVG content: check byte size and presence of root `<svg` element.
pub fn validate_svg(svg: &str, max_size: usize) -> Result<(), AppError> {
    if svg.len() > max_size {
        return Err(AppError::SvgTooLarge { max: max_size, actual: svg.len() });
    }
    if !svg.contains("<svg") {
        return Err(AppError::Validation("Invalid SVG: missing <svg> element".into()));
    }
    Ok(())
}

/// Sanitize SVG by stripping dangerous tags and event-handler attributes.
///
/// Removes: `<script>`, `<foreignObject>` blocks and common event handler
/// attributes (onclick, onload, onerror, onmouseover, onmouseout, onfocus,
/// onblur) without requiring an external regex crate.
pub fn sanitize_svg(svg: &str) -> String {
    let mut result = svg.to_string();
    result = remove_tag_block(&result, "script");
    result = remove_tag_block(&result, "foreignObject");
    result = remove_event_handlers(&result);
    result
}

// ── helpers ───────────────────────────────────────────────────────────────────

/// Remove all occurrences of `<tag_name ...>...</tag_name>` (case-insensitive).
fn remove_tag_block(input: &str, tag_name: &str) -> String {
    let open = format!("<{}", tag_name);
    let close = format!("</{}>", tag_name);
    let mut result = String::with_capacity(input.len());
    let mut remaining = input;

    loop {
        let lower = remaining.to_lowercase();
        match lower.find(&open.to_lowercase()) {
            None => {
                result.push_str(remaining);
                break;
            }
            Some(start) => {
                result.push_str(&remaining[..start]);
                match lower[start..].find(&close.to_lowercase()) {
                    Some(rel_end) => {
                        let end = start + rel_end + close.len();
                        remaining = &remaining[end..];
                    }
                    None => {
                        // Malformed – drop everything from `<tag` onwards.
                        break;
                    }
                }
            }
        }
    }
    result
}

/// Remove dangerous event-handler attributes from SVG markup.
fn remove_event_handlers(svg: &str) -> String {
    const HANDLERS: &[&str] = &[
        "onclick", "onload", "onerror", "onmouseover",
        "onmouseout", "onfocus", "onblur",
    ];

    let mut result = svg.to_string();

    for handler in HANDLERS {
        // Keep replacing until no more occurrences remain.
        loop {
            let lower = result.to_lowercase();
            match lower.find(handler) {
                None => break,
                Some(pos) => {
                    // Expect `handler="..."` or `handler='...'`
                    let after_name = pos + handler.len();
                    // Skip optional whitespace before `=`
                    let eq_pos = result[after_name..]
                        .chars()
                        .position(|c| c == '=' || c == '>' || c == ' ' || c == '\n');

                    match eq_pos {
                        Some(rel) if result.as_bytes()[after_name + rel] == b'=' => {
                            let after_eq = after_name + rel + 1;
                            if after_eq >= result.len() {
                                break;
                            }
                            let quote = result.as_bytes()[after_eq] as char;
                            if quote == '"' || quote == '\'' {
                                if let Some(end_q) = result[after_eq + 1..].find(quote) {
                                    let attr_end = after_eq + 1 + end_q + 1;
                                    result = format!("{}{}", &result[..pos], &result[attr_end..]);
                                    continue;
                                }
                            }
                            // No closing quote found – remove just the attribute name.
                            result = format!("{}{}", &result[..pos], &result[after_name..]);
                        }
                        _ => {
                            // Not followed by `=`, remove the bare word.
                            result = format!("{}{}", &result[..pos], &result[after_name..]);
                        }
                    }
                }
            }
        }
    }
    result
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_rejects_oversized_svg() {
        let svg = format!("<svg>{}</svg>", "x".repeat(1_000_001));
        assert!(validate_svg(&svg, 1_000_000).is_err());
    }

    #[test]
    fn validate_rejects_non_svg() {
        assert!(validate_svg("<html></html>", 1_000_000).is_err());
    }

    #[test]
    fn validate_accepts_valid_svg() {
        assert!(validate_svg("<svg><rect/></svg>", 1_000_000).is_ok());
    }

    #[test]
    fn sanitize_removes_script_block() {
        let svg = r#"<svg><script>alert(1)</script><rect/></svg>"#;
        let clean = sanitize_svg(svg);
        assert!(!clean.contains("<script"));
        assert!(clean.contains("<rect/>"));
    }

    #[test]
    fn sanitize_removes_onclick() {
        let svg = r#"<svg><rect onclick="bad()"/></svg>"#;
        let clean = sanitize_svg(svg);
        assert!(!clean.contains("onclick"));
        assert!(clean.contains("<rect"));
    }
}
