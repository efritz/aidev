package com.example;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.function.Predicate;

public class Example {
    // Fields with different modifiers
    private int field1 = 100;
    protected String field2 = "test";
    public static final double PI = 3.14159;
    
    // Field with no initializer
    private List<String> items;
    
    // Constructor
    public Example() {
        this.items = new ArrayList<>();
    }
    
    // Methods with different modifiers
    public void addItem(String item) {
        items.add(item);
    }
    
    private String getFirstItem() {
        return items.isEmpty() ? null : items.get(0);
    }
    
    protected static int calculateSum(int a, int b) {
        return a + b;
    }
    
    // Method with lambda expressions
    public void processItems() {
        // Lambda assigned to variable
        Predicate<String> isNotEmpty = s -> !s.isEmpty();
        
        // Lambda in method argument
        items.removeIf(s -> s.isEmpty());
        
        // Method reference
        items.forEach(System.out::println);
        
        // Lambda with block body
        Function<String, Integer> getLength = s -> {
            if (s == null) return 0;
            return s.length();
        };
        
        // Use lambdas to avoid unused variable warnings
        if (isNotEmpty.test("test")) {
            System.out.println(getLength.apply("test"));
        }
    }
    
    // Inner class
    private class InnerExample {
        private String innerField;
        
        public InnerExample(String value) {
            this.innerField = value;
        }
        
        public String getInnerField() {
            return innerField;
        }
    }
    
    // Inner interface
    public interface ExampleListener {
        void onItemAdded(String item);
        void onItemRemoved(String item);
    }
    
    // Inner enum
    public enum Status {
        ACTIVE, INACTIVE, PENDING;
        
        private String description;
        
        public String getDescription() {
            return description;
        }
        
        public void setDescription(String description) {
            this.description = description;
        }
    }
}

// Another class in the same file
class AnotherExample {
    private int value;
    
    public AnotherExample(int value) {
        this.value = value;
    }
    
    public int getValue() {
        return value;
    }
}

// Interface
interface Processor {
    // Constant in interface
    String VERSION = "1.0";
    
    void process(String input);
    String getResult();
}

// Enum
enum Priority {
    LOW, MEDIUM, HIGH
}
