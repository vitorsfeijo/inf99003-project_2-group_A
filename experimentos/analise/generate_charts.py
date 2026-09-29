import json
import os
import matplotlib.pyplot as plt
import pandas as pd

script_dir = os.path.dirname(os.path.abspath(__file__))
results_csv = os.path.join(script_dir, "..", "resultados", "benchmark_results.csv")
output_dir = script_dir

if not os.path.exists(results_csv):
    print(f"Arquivo de resultados não encontrado: {results_csv}")
    exit(1)

df = pd.read_csv(results_csv)

# Configurar estilo dos gráficos
plt.style.use('ggplot')
fig_size = (10, 6)

# 1. Gráfico de Atraso Acumulado
plt.figure(figsize=fig_size)
pivot_overdue = df.pivot(index='scenarioId', columns='strategyId', values='totalOverdueDays')
pivot_overdue.plot(kind='bar', figsize=fig_size, width=0.8)
plt.title('Comparação de Dias de Atraso Acumulados por Método')
plt.xlabel('Cenário Sintético')
plt.ylabel('Dias de Atraso Acumulados')
plt.xticks(rotation=0)
plt.legend(title='Estratégia')
plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'grafico_atraso_acumulado.png'), dpi=300)
plt.close()

# 2. Gráfico de Deslocamento Total (KM)
plt.figure(figsize=fig_size)
pivot_dist = df.pivot(index='scenarioId', columns='strategyId', values='totalTravelDistanceKm')
pivot_dist.plot(kind='bar', figsize=fig_size, width=0.8)
plt.title('Comparação de Deslocamento Total (km) por Método')
plt.xlabel('Cenário Sintético')
plt.ylabel('Deslocamento Total (km)')
plt.xticks(rotation=0)
plt.legend(title='Estratégia')
plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'grafico_deslocamento_km.png'), dpi=300)
plt.close()

# 3. Gráfico de Tempo Computacional (ms)
plt.figure(figsize=fig_size)
pivot_time = df.pivot(index='scenarioId', columns='strategyId', values='executionTimeMs')
pivot_time.plot(kind='bar', figsize=fig_size, width=0.8)
plt.title('Tempo de Execução Computacional (ms)')
plt.xlabel('Cenário Sintético')
plt.ylabel('Tempo de Execução (ms)')
plt.xticks(rotation=0)
plt.legend(title='Estratégia')
plt.tight_layout()
plt.savefig(os.path.join(output_dir, 'grafico_tempo_execucao.png'), dpi=300)
plt.close()

print(f"📊 Gráficos de análise gerados com sucesso em: {output_dir}")
