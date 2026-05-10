# Sapphire Design System -- Forms

## Text Input

```tsx
<div className="space-y-1.5">
  <label className="text-sm font-bold text-muted-foreground">
    Full Name
    <span className="text-destructive mr-1">*</span>
  </label>
  <input
    type="text"
    className="w-full min-h-[48px] bg-accent border border-border/40 rounded-xl
               px-5 py-3.5 text-base text-foreground placeholder:text-muted-foreground/50
               focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40
               transition-all"
    placeholder="Enter full name"
  />
</div>
```

| Property | Value |
|----------|-------|
| Min Height | `min-h-[48px]` |
| Background | `bg-accent` |
| Border | `border border-border/40` |
| Radius | `rounded-xl` (12px) |
| Padding | `px-5 py-3.5` |
| Font | `text-base text-foreground` |
| Placeholder | `placeholder:text-muted-foreground/50` |
| Focus | `ring-2 ring-primary/20 border-primary/40` |

---

## Labels

```tsx
// Standard label
<label className="text-sm font-bold text-muted-foreground">
  Field Name
</label>

// Required label
<label className="text-sm font-bold text-muted-foreground">
  Field Name
  <span className="text-destructive mr-1">*</span>
</label>

// Label with helper icon
<label className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
  Field Name
  <Info className="w-3.5 h-3.5 text-muted-foreground/50" />
</label>
```

Labels are always positioned **above** the input with `space-y-1.5` gap.

---

## Error State

```tsx
<div className="space-y-1.5">
  <label className="text-sm font-bold text-muted-foreground">
    Email
    <span className="text-destructive mr-1">*</span>
  </label>
  <input
    className="w-full min-h-[48px] bg-accent border border-destructive/50 rounded-xl
               px-5 py-3.5 text-base text-foreground
               ring-2 ring-destructive/10
               focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:border-destructive"
  />
  <p className="text-[11px] text-destructive font-bold">
    Email address is required
  </p>
</div>
```

| Error Property | Value |
|----------------|-------|
| Border | `border-destructive/50` |
| Ring | `ring-2 ring-destructive/10` |
| Message font | `text-[11px] text-destructive font-bold` |
| Message position | Below input, within same `space-y-1.5` container |

---

## Select / Dropdown

```tsx
<div className="space-y-1.5">
  <label className="text-sm font-bold text-muted-foreground">Room Type</label>
  <div className="relative">
    <select
      className="w-full min-h-[48px] bg-accent border border-border/40 rounded-xl
                 px-5 py-3.5 text-base text-foreground appearance-none
                 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40
                 cursor-pointer"
    >
      <option value="">Select room type</option>
      <option value="standard">Standard</option>
      <option value="suite">Suite</option>
    </select>
    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4
                            text-muted-foreground pointer-events-none" />
  </div>
</div>
```

Note: Chevron is positioned on the **left** side because of RTL layout.

---

## Textarea

```tsx
<div className="space-y-1.5">
  <label className="text-sm font-bold text-muted-foreground">Notes</label>
  <textarea
    rows={4}
    className="w-full bg-accent border border-border/40 rounded-xl
               px-5 py-3.5 text-base text-foreground placeholder:text-muted-foreground/50
               resize-none
               focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
    placeholder="Add notes..."
  />
</div>
```

---

## Number Stepper

```tsx
<div className="space-y-1.5">
  <label className="text-sm font-bold text-muted-foreground">Guests</label>
  <div className="inline-flex items-center bg-accent border border-border/40
                  rounded-full overflow-hidden">
    <button
      onClick={decrement}
      className="w-11 h-11 flex items-center justify-center hover:bg-border/30
                 transition-colors"
    >
      <Minus className="w-4 h-4" />
    </button>
    <span className="w-12 text-center text-base font-bold text-foreground">
      {value}
    </span>
    <button
      onClick={increment}
      className="w-11 h-11 flex items-center justify-center hover:bg-border/30
                 transition-colors"
    >
      <Plus className="w-4 h-4" />
    </button>
  </div>
</div>
```

---

## Toggle / Switch

```tsx
<button
  role="switch"
  aria-checked={enabled}
  onClick={() => setEnabled(!enabled)}
  className={cn(
    "relative w-12 h-7 rounded-full transition-colors",
    enabled ? "bg-primary" : "bg-border"
  )}
>
  <span
    className={cn(
      "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform",
      enabled ? "left-0.5" : "left-[calc(100%-1.625rem)]"  // RTL: reversed
    )}
  />
</button>
```

| Property | Value |
|----------|-------|
| Track | `w-12 h-7 rounded-full` |
| Thumb | `w-6 h-6 rounded-full bg-white shadow-sm` |
| Active | `bg-primary` |
| Inactive | `bg-border` |
| Movement | RTL-aware (left to right = off to on) |

---

## Checkbox

```tsx
<label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
  <input
    type="checkbox"
    className="w-5 h-5 rounded border-border text-primary
               focus:ring-2 focus:ring-primary/20 cursor-pointer"
  />
  <span className="text-base text-foreground">Accept terms and conditions</span>
</label>
```

---

## Radio Group

```tsx
<fieldset className="space-y-2">
  <legend className="text-sm font-bold text-muted-foreground mb-2">
    Payment Method
  </legend>
  {options.map(option => (
    <label
      key={option.value}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
        selected === option.value
          ? "border-primary/40 bg-primary/5 ring-2 ring-primary/10"
          : "border-border/40 bg-accent hover:bg-accent/80"
      )}
    >
      <input
        type="radio"
        name="payment"
        value={option.value}
        checked={selected === option.value}
        onChange={() => setSelected(option.value)}
        className="w-5 h-5 text-primary focus:ring-primary/20"
      />
      <div>
        <span className="text-base font-bold text-foreground">{option.label}</span>
        {option.description && (
          <p className="text-sm text-muted-foreground">{option.description}</p>
        )}
      </div>
    </label>
  ))}
</fieldset>
```

---

## Date Picker

```tsx
// Trigger input
<div className="space-y-1.5">
  <label className="text-sm font-bold text-muted-foreground">Check-in Date</label>
  <button
    onClick={openCalendar}
    className="w-full min-h-[48px] bg-accent border border-border/40 rounded-xl
               px-5 py-3.5 text-base text-right flex items-center justify-between
               focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
  >
    <Calendar className="w-4 h-4 text-muted-foreground" />
    <span className={value ? "text-foreground" : "text-muted-foreground/50"}>
      {value ? formatDate(value) : "Select date"}
    </span>
  </button>
</div>

// Calendar popup
<div className="absolute top-full mt-2 bg-card rounded-[20px] shadow-2xl
                border border-border p-4 z-30 w-80">
  {/* Calendar grid rendered here */}
</div>
```

---

## File Upload

```tsx
<div className="space-y-1.5">
  <label className="text-sm font-bold text-muted-foreground">Attachment</label>
  <div
    onDragOver={handleDragOver}
    onDrop={handleDrop}
    className={cn(
      "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
      isDragging
        ? "border-primary bg-primary/5"
        : "border-border/40 bg-accent hover:border-border"
    )}
  >
    <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
    <p className="text-sm text-foreground font-bold mb-1">
      Drag files here or click to upload
    </p>
    <p className="text-[13px] text-muted-foreground">
      PDF, JPG, PNG up to 10MB
    </p>
    <input type="file" className="hidden" ref={fileInputRef} />
  </div>

  {/* Preview */}
  {file && (
    <div className="flex items-center gap-3 bg-accent rounded-xl p-3 mt-2">
      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{file.name}</p>
        <p className="text-[11px] text-muted-foreground">{formatSize(file.size)}</p>
      </div>
      <button onClick={removeFile} className="w-8 h-8 flex items-center justify-center
                                               rounded-lg hover:bg-border/30">
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  )}
</div>
```

---

## Field Grouping

Forms with multiple sections use cards with section headers.

```tsx
<form className="space-y-6">
  {/* Section 1 */}
  <div className="bg-card rounded-[20px] border border-border p-6">
    <h3 className="text-lg font-semibold text-foreground mb-4">Guest Information</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <InputField label="First Name" required />
      <InputField label="Last Name" required />
      <InputField label="Email" type="email" />
      <InputField label="Phone" type="tel" />
    </div>
  </div>

  {/* Section 2 */}
  <div className="bg-card rounded-[20px] border border-border p-6">
    <h3 className="text-lg font-semibold text-foreground mb-4">Stay Details</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <DateField label="Check-in" required />
      <DateField label="Check-out" required />
      <SelectField label="Room Type" required />
      <NumberField label="Guests" />
    </div>
  </div>
</form>
```

---

## Form Layout Grid

```tsx
// Standard 2-column form
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  {/* Fields */}
</div>

// 3-column form (settings pages)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Fields */}
</div>

// Full-width field (textarea, file upload)
<div className="col-span-full">
  <TextareaField label="Notes" />
</div>
```

---

## Disabled State

```tsx
<input
  disabled
  className="w-full min-h-[48px] bg-accent border border-border/40 rounded-xl
             px-5 py-3.5 text-base text-foreground
             opacity-50 cursor-not-allowed"
/>
```

---

## Read-Only State (Locked Fields)

Used for external reservation fields that cannot be edited.

```tsx
<div className="space-y-1.5">
  <label className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
    Booking Source
    <Lock className="w-3 h-3 text-muted-foreground/50" />
  </label>
  <div className="w-full min-h-[48px] bg-accent/50 border border-border/20 rounded-xl
                  px-5 py-3.5 text-base text-foreground/70 cursor-default">
    Booking.com
  </div>
</div>
```

Three field states:
1. **Editable** -- standard input styling
2. **Locked** -- read-only appearance with lock icon, reduced opacity
3. **Warning** -- editable but with amber warning that changes may not sync back
