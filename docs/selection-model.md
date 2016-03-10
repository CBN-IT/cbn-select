# Cbn-Select model description

This document describes the process of and results from changing the selected value and/or options.

Note: there are two types of value setting which distinguish the outcome of a value setting action:

- directly, as a result of user's interaction (e.g. typing / choosing a value from the dropdown);
- indirectly (programmatically).


## Use cases and their expected results

1. The element has a `value` and `options` set at initialization time.
Those properties can be set in any order by Polymer, so we need to handle both situations:

- if the value is set after the options, it will be selected right away;
- else, the value is saved (see the **delayed Value** section) and set when the options list is provided;

2. User selects a new value (direct setting).

- only change the value if it is valid (i.e. it is found inside the options list or freeText is active);
- otherwise, just mark the input as invalid (the model remains to the old value);

3. Input value is changed indirectly (programmatically/ internally / as result of a model change).

3.1. Default case:

- check if the value is valid (or `freeText` is on); if true, set the value right away;
- otherwise, delay the value using the `_delayedValue` mechanism and leave it unchanged;

3.2. A delayed value is present, but the value is changed again.

- unset the *delayed value* and repeat the process at **3.**;

4. Value left unchanged, new options are provided to the input (either directly or via a data source).

- try to re-select the value (indirectly, see **3.**); if this fails, unset the value (i.e. set it to empty);

## The delayed value mechanism

The *delayed value* mechanism will be used as default behavior to resolve value/options setting race conditions (as 
seen in the use cases section).

This involves saving an indirect value that would be invalid with the current options into a private register 
(`_delayedValue`) and restoring it when the new options become available.

Note: if a data source is used, after setting the delayed value, we should issue a query request to automatically 
fetch the options, but only if this wasn't already done, to avoid infinite loops if the expected option never comes;

