# Gera as planilhas usadas nos testes do leitor de .xlsx (requer openpyxl).
# Uso: python make-fixtures.py
import datetime
from openpyxl import Workbook
from openpyxl.cell.rich_text import CellRichText, TextBlock
from openpyxl.cell.text import InlineFont

wb = Workbook()
hidden = wb.active
hidden.title = 'Oculta'
hidden['A1'] = 'não deve ser lida'
hidden.sheet_state = 'hidden'
ws = wb.create_sheet('Pacientes')
ws.append(['Código', 'Latitude', 'Longitude', 'Última visita', 'Prazo rígido', 'Categorias', 'Ausência motivo'])
ws.append(['A1', -30.0012, -51.0034, datetime.date(2026, 9, 20), datetime.datetime(2026, 10, 10, 14, 30), 'tecnico_enfermagem:2; enfermagem', 'Férias & viagem <SP>'])
ws.append([])  # linha 3 vazia: a numeração do Excel deve ser mantida
ws.append(['A2', '-30,002', -51.001, '15/09/2026', None, None, None])
ws['G4'] = CellRichText([TextBlock(InlineFont(b=True), 'Inter'), 'nação'])
ws['D5'] = 45658
ws['D5'].number_format = 'dd/mm/yyyy'
ws['A5'] = 'A3'
ws['B5'] = -30.003
ws['C5'] = -51.003
ws['H1'] = '=1+1'
wb.save('openpyxl.xlsx')
