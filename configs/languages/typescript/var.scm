;; Capture let/const definitions at the package level

(program
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name
    )
  ) @declaration
)

;; ...and with an export

(program
  (export_statement
    (lexical_declaration
      (variable_declarator
        name: (identifier) @name
      )
    ) @declaration
  )
)

;; Capture var definitions at the package level

(program
  (variable_declaration
    (variable_declarator
      name: (identifier) @name
    )
  ) @declaration
)

;; ...and with an explicit export

(program
  (export_statement
    (variable_declaration
      (variable_declarator
        name: (identifier) @name
      )
    ) @declaration
  )
)
