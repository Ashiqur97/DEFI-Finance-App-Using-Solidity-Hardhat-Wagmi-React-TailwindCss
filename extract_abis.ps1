# PowerShell script to extract contract ABIs to separate files

$contracts = @("Lending", "PriceOracle", "Swap", "Timelock", "Token")
$outputDir = "contract_abis"

# Create output directory if it doesn't exist
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
    Write-Host "Created directory: $outputDir" -ForegroundColor Green
}

foreach ($contract in $contracts) {
    Write-Host "Processing $contract contract..." -ForegroundColor Cyan
    
    $filePath = "artifacts/contracts/$contract.sol/$contract.json"
    $outputPath = "$outputDir/$contract.abi.json"
    
    if (Test-Path $filePath) {
        $contractJson = Get-Content -Raw $filePath | ConvertFrom-Json
        $contractJson.abi | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputPath -Encoding utf8
        Write-Host "  ABI extracted to: $outputPath" -ForegroundColor Green
        
        # Also create a readable summary file
        $summaryPath = "$outputDir/$contract.summary.txt"
        $summary = @()
        $summary += "=== $contract Contract ABI Summary ==="
        $summary += ""
        
        foreach ($item in $contractJson.abi) {
            $itemType = $item.type
            $itemName = if ($item.name) { $item.name } else { "<constructor>" }
            
            $line = "$itemType`: $itemName"
            
            if ($item.inputs.Count -gt 0) {
                $inputParams = @()
                foreach ($input in $item.inputs) {
                    $inputParams += "$($input.type) $($input.name)"
                }
                $line += "(" + ($inputParams -join ", ") + ")"
            } else {
                $line += "()"
            }
            
            if ($item.outputs.Count -gt 0) {
                $outputParams = @()
                foreach ($output in $item.outputs) {
                    $outputName = if ($output.name) { $output.name } else { "" }
                    $outputParams += "$($output.type) $outputName"
                }
                $line += " returns (" + ($outputParams -join ", ") + ")"
            }
            
            if ($item.stateMutability) {
                $line += " [$($item.stateMutability)]"
            }
            
            $summary += $line
        }
        
        $summary | Out-File -FilePath $summaryPath -Encoding utf8
        Write-Host "  Summary created at: $summaryPath" -ForegroundColor Green
    } else {
        Write-Host "  File not found: $filePath" -ForegroundColor Red
    }
}

Write-Host "\nAll contract ABIs have been extracted to the $outputDir directory." -ForegroundColor Yellow