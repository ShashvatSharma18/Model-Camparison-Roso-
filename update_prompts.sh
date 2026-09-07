#!/bin/bash

# Update frontend prompt
sed -i 's/You MUST write and translate ALL output text strictly into ${selectedLanguage}. Do NOT write in English./You MUST write and translate ALL output text strictly into ${selectedLanguage}. Do NOT write in English. IMPORTANT: Even if the target schema keys or descriptions are written in English, the final generated string values MUST be in ${selectedLanguage}./g' /home/appinventiv/Desktop/Model\ Camparison\ Roso/frontend/src/pages/ContentGenerationPage.tsx

sed -i 's/You MUST write and translate ALL output text strictly into Hindi using Devanagari script. Do NOT write in English./You MUST write and translate ALL output text strictly into Hindi using Devanagari script. Do NOT write in English. IMPORTANT: Even if the target schema keys or descriptions are written in English, the final generated string values MUST be in Hindi./g' /home/appinventiv/Desktop/Model\ Camparison\ Roso/frontend/src/pages/ContentGenerationPage.tsx

# Update backend prompt
sed -i 's/Write and translate ALL text string values in the JSON output strictly into {target_lang}. Do NOT write in English./Write and translate ALL text string values in the JSON output strictly into {target_lang}. Do NOT write in English. IMPORTANT: Even if the input JSON, target schema keys, or descriptions are written in English, the final generated string values MUST be in {target_lang}./g' /home/appinventiv/Desktop/Model\ Camparison\ Roso/backend/app/main.py

sed -i 's/Write and translate ALL text string values in the JSON output strictly into Hindi using Devanagari script. Do NOT write in English./Write and translate ALL text string values in the JSON output strictly into Hindi using Devanagari script. Do NOT write in English. IMPORTANT: Even if the input JSON, target schema keys, or descriptions are written in English, the final generated string values MUST be in Hindi./g' /home/appinventiv/Desktop/Model\ Camparison\ Roso/backend/app/main.py

