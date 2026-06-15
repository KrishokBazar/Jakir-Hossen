export function exportToCSV(filename: string, data: any[], headers: string[]) {
  if (data.length === 0) {
    alert("No records to export.");
    return;
  }
  
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Format each row
  for (const row of data) {
    const values = row.map((val: any) => {
      const field = val === null || val === undefined ? '' : String(val);
      // Escape inner quotes and wrap in quotes
      const escaped = field.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
