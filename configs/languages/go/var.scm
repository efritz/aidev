;; Capture const blocks at the package level

(source_file
  (const_declaration
    (const_spec
      name: (identifier) @name
    ) @const
  )
)

;; Capture var definitions at the package level

(source_file
  (var_declaration
    (var_spec
      name: (identifier) @name
    ) @var
  )
)

;; Capture var definition blocks at the package level
;;
;; Note that there's a weird asymmetry here bewteen const and var,
;; which necessitates the var_spec_list in this version of the query

(source_file
  (var_declaration
    (var_spec_list
      (var_spec
        name: (identifier) @name
      ) @var
    )
  )
)
