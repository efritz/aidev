package com.example;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.function.Predicate;

// #region CHUNK (class): Example
public class Example {
    // Fields with different modifiers
// #region CHUNK (field): Example.field1
    private int field1 = 100;
// #endregion CHUNK (field): Example.field1
// #region CHUNK (field): Example.field2
    protected String field2 = "test";
// #endregion CHUNK (field): Example.field2
// #region CHUNK (field): Example.PI
    public static final double PI = 3.14159;
// #endregion CHUNK (field): Example.PI
    
    // Field with no initializer
// #region CHUNK (field): Example.items
    private List<String> items;
// #endregion CHUNK (field): Example.items
    
    // Constructor
// #region CHUNK (method): Example.Example
    public Example() {
        this.items = new ArrayList<>();
    }
// #endregion CHUNK (method): Example.Example
    
    // Methods with different modifiers
// #region CHUNK (method): Example.addItem
    public void addItem(String item) {
        items.add(item);
    }
// #endregion CHUNK (method): Example.addItem
    
// #region CHUNK (method): Example.getFirstItem
    private String getFirstItem() {
        return items.isEmpty() ? null : items.get(0);
    }
// #endregion CHUNK (method): Example.getFirstItem
    
// #region CHUNK (method): Example.calculateSum
    protected static int calculateSum(int a, int b) {
        return a + b;
    }
// #endregion CHUNK (method): Example.calculateSum
    
    // Method with lambda expressions
// #region CHUNK (method): Example.processItems
    public void processItems() {
        // Lambda assigned to variable
// #region CHUNK (lambda): Example.processItems.isNotEmpty
        Predicate<String> isNotEmpty = s -> !s.isEmpty();
// #endregion CHUNK (lambda): Example.processItems.isNotEmpty
        
        // Lambda in method argument
        items.removeIf(s -> s.isEmpty());
        
        // Method reference
        items.forEach(System.out::println);
        
        // Lambda with block body
// #region CHUNK (lambda): Example.processItems.getLength
        Function<String, Integer> getLength = s -> {
            if (s == null) return 0;
            return s.length();
        };
// #endregion CHUNK (lambda): Example.processItems.getLength
        
        // Use lambdas to avoid unused variable warnings
        if (isNotEmpty.test("test")) {
            System.out.println(getLength.apply("test"));
        }
    }
// #endregion CHUNK (method): Example.processItems
    
    // Inner class
// #region CHUNK (class): Example.InnerExample
    private class InnerExample {
// #region CHUNK (field): Example.InnerExample.innerField
        private String innerField;
// #endregion CHUNK (field): Example.InnerExample.innerField
        
// #region CHUNK (method): Example.InnerExample.InnerExample
        public InnerExample(String value) {
            this.innerField = value;
        }
// #endregion CHUNK (method): Example.InnerExample.InnerExample
        
// #region CHUNK (method): Example.InnerExample.getInnerField
        public String getInnerField() {
            return innerField;
        }
// #endregion CHUNK (method): Example.InnerExample.getInnerField
    }
// #endregion CHUNK (class): Example.InnerExample
    
    // Inner interface
// #region CHUNK (interface): Example.ExampleListener
    public interface ExampleListener {
// #region CHUNK (method): Example.ExampleListener.onItemAdded
        void onItemAdded(String item);
// #endregion CHUNK (method): Example.ExampleListener.onItemAdded
// #region CHUNK (method): Example.ExampleListener.onItemRemoved
        void onItemRemoved(String item);
// #endregion CHUNK (method): Example.ExampleListener.onItemRemoved
    }
// #endregion CHUNK (interface): Example.ExampleListener
    
    // Inner enum
// #region CHUNK (enum): Example.Status
    public enum Status {
        ACTIVE, INACTIVE, PENDING;
        
// #region CHUNK (field): Example.Status.description
        private String description;
// #endregion CHUNK (field): Example.Status.description
        
// #region CHUNK (method): Example.Status.getDescription
        public String getDescription() {
            return description;
        }
// #endregion CHUNK (method): Example.Status.getDescription
        
// #region CHUNK (method): Example.Status.setDescription
        public void setDescription(String description) {
            this.description = description;
        }
// #endregion CHUNK (method): Example.Status.setDescription
    }
// #endregion CHUNK (enum): Example.Status
}
// #endregion CHUNK (class): Example

// Another class in the same file
// #region CHUNK (class): AnotherExample
class AnotherExample {
// #region CHUNK (field): AnotherExample.value
    private int value;
// #endregion CHUNK (field): AnotherExample.value
    
// #region CHUNK (method): AnotherExample.AnotherExample
    public AnotherExample(int value) {
        this.value = value;
    }
// #endregion CHUNK (method): AnotherExample.AnotherExample
    
// #region CHUNK (method): AnotherExample.getValue
    public int getValue() {
        return value;
    }
// #endregion CHUNK (method): AnotherExample.getValue
}
// #endregion CHUNK (class): AnotherExample

// Interface
// #region CHUNK (interface): Processor
interface Processor {
    // Constant in interface
    String VERSION = "1.0";
    
// #region CHUNK (method): Processor.process
    void process(String input);
// #endregion CHUNK (method): Processor.process
// #region CHUNK (method): Processor.getResult
    String getResult();
// #endregion CHUNK (method): Processor.getResult
}
// #endregion CHUNK (interface): Processor

// Enum
// #region CHUNK (enum): Priority
enum Priority {
    LOW, MEDIUM, HIGH
}
// #endregion CHUNK (enum): Priority
