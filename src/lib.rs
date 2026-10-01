use js_sys::Math;
use roxmltree::Document;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ObfuscatedMapAsset {
    pub anonymized_svg: String,
    pub token_map: HashMap<String, String>, // token -> title/name
}

// Simple xor scramble tool to keep internal SVG mappings secure in the browser
fn obfuscate_id(id: &str) -> String {
    id.as_bytes()
        .iter()
        .map(|b| format!("{:02x}", b ^ 0x5A))
        .collect()
}

#[wasm_bindgen]
pub struct WorldGame {
    tokens: Vec<String>,
    token_to_name: HashMap<String, String>,
    token_to_raw_id: HashMap<String, String>, // Securely stores token -> "IN" map in Rust memory
    current_target_idx: usize,
    score: u32,
    total_turns: u32,
    wrong_attempts_counter: u32,
}

#[wasm_bindgen]
impl WorldGame {
    pub fn process_svg_asset(raw_svg: &str) -> Result<JsValue, JsValue> {
        let doc = Document::parse(raw_svg).map_err(|e| e.to_string())?;
        let mut token_map = HashMap::new();
        let mut clean_svg = raw_svg.to_string();

        for node in doc
            .descendants()
            .filter(|n| n.is_element() && n.has_attribute("id"))
        {
            let id = node.attribute("id").unwrap_or("");
            let title = node.attribute("title").unwrap_or(id);

            if !id.is_empty() {
                let secure_token = obfuscate_id(id);
                token_map.insert(secure_token.clone(), title.to_string());

                if let Some(title_attr) = node.attribute("title") {
                    let target_to_remove = format!("title=\"{}\"", title_attr);
                    clean_svg = clean_svg.replace(&target_to_remove, "");
                }

                let old_id_attr = format!("id=\"{}\"", id);
                let new_id_attr = format!("id=\"{}\"", secure_token);
                clean_svg = clean_svg.replace(&old_id_attr, &new_id_attr);
            }
        }

        let asset = ObfuscatedMapAsset {
            anonymized_svg: clean_svg,
            token_map,
        };
        serde_wasm_bindgen::to_value(&asset).map_err(|e| e.to_string().into())
    }

    #[wasm_bindgen(constructor)]
    pub fn new(obfuscated_json_data: JsValue, whitelist_codes: JsValue) -> Self {
        let token_map: HashMap<String, String> =
            serde_wasm_bindgen::from_value(obfuscated_json_data).unwrap_or_default();
        let whitelist: Vec<String> =
            serde_wasm_bindgen::from_value(whitelist_codes).unwrap_or_default();
        let has_whitelist = !whitelist.is_empty();

        let mut tokens = Vec::new();
        let mut token_to_name = HashMap::new();
        let mut token_to_raw_id = HashMap::new();

        for (token, name) in token_map {
            // Reconstruct the raw country code from token securely inside Rust memory
            let bytes: Vec<u8> = (0..token.len())
                .step_by(2)
                .filter_map(|i| u8::from_str_radix(&token[i..i + 2], 16).ok())
                .map(|b| b ^ 0x5A)
                .collect();

            if let Ok(raw_id) = String::from_utf8(bytes) {
                // Filter step: Skip the country if a custom level whitelist configuration excludes it
                if has_whitelist && !whitelist.contains(&raw_id) {
                    continue;
                }
                tokens.push(token.clone());
                token_to_name.insert(token.clone(), name);
                token_to_raw_id.insert(token.clone(), token.clone());
            }
        }

        let mut game = Self {
            tokens,
            token_to_name,
            token_to_raw_id,
            current_target_idx: 0,
            score: 0,
            total_turns: 0,
            wrong_attempts_counter: 0,
        };
        game.pick_next();
        game
    }

    fn pick_next(&mut self) {
        self.wrong_attempts_counter = 0; // Reset counter for new target
        if !self.tokens.is_empty() {
            self.current_target_idx = (Math::random() * self.tokens.len() as f64).floor() as usize;
        }
    }

    pub fn get_current_target_display(&self) -> String {
        if self.tokens.is_empty() {
            return "GAME_OVER".to_string();
        }
        let current_token = &self.tokens[self.current_target_idx];
        self.token_to_name
            .get(current_token)
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string())
    }

    // Returns the active secure token ID string of the target country
    pub fn get_current_target_token(&self) -> String {
        if self.tokens.is_empty() {
            return "".to_string();
        }
        self.tokens[self.current_target_idx].clone()
    }

    // Logic outcome values: 0 = Wrong click, 1 = Correct click, 2 = Struck out after 6 consecutive failures
    pub fn handle_click(&mut self, clicked_token: &str) -> u32 {
        if self.tokens.is_empty() {
            return 0;
        }

        let correct_token = &self.tokens[self.current_target_idx];

        if clicked_token == correct_token {
            self.total_turns += 1;
            self.score += 1;
            self.tokens.remove(self.current_target_idx);
            self.pick_next();
            1
        } else {
            self.wrong_attempts_counter += 1;
            if self.wrong_attempts_counter >= 6 {
                self.total_turns += 1; // Count strikeout as a completed turn
                                       // Remove the missed target from rotation pool and skip to next question
                self.tokens.remove(self.current_target_idx);
                self.pick_next();
                2
            } else {
                0
            }
        }
    }

    pub fn get_score(&self) -> u32 {
        self.score
    }
    pub fn get_total_turns(&self) -> u32 {
        self.total_turns
    }
}
