# PowerShell script to view contract ABIs

$contracts = @("Lending", "PriceOracle", "Swap", "Timelock", "Token")

foreach ($contract in $contracts) {
    Write-Host "\n=== $contract Contract ABI ===" -ForegroundColor Green
    
    $filePath = "artifacts/contracts/$contract.sol/$contract.json"
    
    if (Test-Path $filePath) {
        $contractJson = Get-Content -Raw $filePath | ConvertFrom-Json
        $contractJson.abi | ForEach-Object {
            $functionType = $_.type
            $functionName = if ($_.name) { $_.name } else { "<constructor>" }
            
            Write-Host "$functionType`: $functionName" -ForegroundColor Yellow
            
            if ($_.inputs.Count -gt 0) {
                Write-Host "  Inputs:" -ForegroundColor Cyan
                foreach ($input in $_.inputs) {
                    Write-Host "    - $($input.name)`: $($input.type)" -ForegroundColor White
                }
            }
            
            if ($_.outputs.Count -gt 0) {
                Write-Host "  Outputs:" -ForegroundColor Cyan
                foreach ($output in $_.outputs) {
                    $outputName = if ($output.name) { $output.name } else { "<unnamed>" }
                    Write-Host "    - $outputName`: $($output.type)" -ForegroundColor White
                }
            }
            
            Write-Host "  Mutability: $($_.stateMutability)" -ForegroundColor Magenta
            Write-Host ""
        }
    } else {
        Write-Host "File not found: $filePath" -ForegroundColor Red
    }
}