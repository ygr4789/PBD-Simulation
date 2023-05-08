INPUT_DIR=./object
OUTPUT_DIR=./data

EXTENSION=obj
INPUT=$(foreach ext, $(EXTENSION),$(wildcard $(INPUT_DIR)/*.$(ext)))
JSON=$(INPUT:%.$(EXTENSION)=%.json)

GERBAGE_SUFFIX=__sf.obj __tracked_surface.stl _.csv

TETWIND_DIR=./FloatTetwild_bin
CONVERTER_DIR=./converter.py

EDGE_LENGTH=0.1 # 0.05 default
EPSILON=0.01 # 0.001 default

OUTPUT_DIAG_LENGTH=2

all: $(JSON)

%.msh: %.$(EXTENSION)
	$(TETWIND_DIR) -i $< -o $* -l $(EDGE_LENGTH) -e $(EPSILON)\
	&& rm -f $(foreach suf, $(GERBAGE_SUFFIX), $*$(suf))

%.json: %.msh
	python $(CONVERTER_DIR) $*_.msh -d $(OUTPUT_DIR) -l $(OUTPUT_DIAG_LENGTH) \
	&& rm -f $*_.msh

clean:
	rm -f *_sf.obj *_tracked_surface.stl *.csv *.msh *.json
	