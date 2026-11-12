Generate one realistic, unique customer for an e-commerce checkout form.

Rules:
- firstName: a real-looking first name starting with "{{FIRST_INITIAL}}", letters only, 2-20 characters.
- lastName: a real-looking last name starting with "{{LAST_INITIAL}}", letters only, 2-20 characters.
- postalCode: a valid-looking ZIP code in {{STATE}}, exactly 5 digits, as a string.
- Avoid common placeholder names like John Doe.

Return exactly this JSON shape and nothing else:
{"firstName": "string", "lastName": "string", "postalCode": "string"}
