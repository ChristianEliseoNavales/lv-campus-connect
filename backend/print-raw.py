import sys
import os

def print_raw_to_port(filepath, port):
    """
    Print raw text file directly to printer port
    This bypasses Windows Print Spooler formatting
    """
    try:
        # Read the receipt file
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Open the printer port for writing
        # Use binary mode to send raw data
        port_path = f'\\\\.\\{port}'
        
        print(f'Opening printer port: {port_path}')
        print(f'Sending {len(content)} characters...')
        
        # Write directly to the printer port
        with open(port_path, 'wb') as printer:
            # Convert text to bytes (ASCII encoding for thermal printer)
            data = content.encode('ascii', errors='replace')
            printer.write(data)
            printer.flush()
        
        print('✅ Data sent successfully to printer port')
        return 0
        
    except PermissionError:
        print('❌ Permission denied. Try running as Administrator.')
        return 1
    except FileNotFoundError as e:
        print(f'❌ File not found: {e}')
        print('Make sure the printer port exists and is accessible.')
        return 1
    except Exception as e:
        print(f'❌ Error: {e}')
        return 1

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: python print-raw.py <filepath> <port>')
        print('Example: python print-raw.py receipt.txt USB001')
        sys.exit(1)
    
    filepath = sys.argv[1]
    port = sys.argv[2]
    
    sys.exit(print_raw_to_port(filepath, port))

